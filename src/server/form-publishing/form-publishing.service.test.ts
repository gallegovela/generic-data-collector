import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import type { DraftForm } from "@/lib/form-editor/form-editor.schema";
import { FormVersionSchema, validateSubmission } from "@/lib/form-schema";
import { isValidSlug } from "@/lib/form-publishing/slug";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import { createForm, saveDraft, archiveForm } from "@/server/forms/form.service";
import {
  PublishValidationError,
  getFormForFilling,
  getFormVersion,
  getPublishedFormBySlug,
  getPublishingState,
  publishForm,
  setFormAccessMode,
  unpublishForm,
} from "./form-publishing.service";

// Requiere PostgreSQL accesible vía DATABASE_URL (ver specs/form-publishing/test-plan.md).

const text = (id: string, label: string, required = false) =>
  ({ id, type: "text" as const, label, required, config: {} });

function draftOf(title: string, fields = [text("a", "Etiqueta A")]): DraftForm {
  return { title, fields };
}

describe("form-publishing.service", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  const userA = "user-a";

  beforeAll(async () => {
    orgA = await createOrganization({ name: "Org A (form-publishing.service test)" });
    orgB = await createOrganization({ name: "Org B (form-publishing.service test)" });
  });

  afterAll(async () => {
    const ids = [orgA.id, orgB.id];
    await prisma.formVersion.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.form.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.organization.deleteMany({ where: { id: { in: ids } } });
  });

  async function newForm(name: string, draft: DraftForm = draftOf(name)): Promise<string> {
    const form = await createForm(orgA.id, { name });
    await saveDraft(orgA.id, form.id, { draft });
    return form.id;
  }

  // Cubre: CA-PUB-01
  it("CA-PUB-01: publicar v1, cambiar el borrador y publicar v2 conserva v1 intacta", async () => {
    const id = await newForm("CA01", draftOf("CA01", [text("a", "Etiqueta antigua")]));
    const v1 = await publishForm(orgA.id, userA, id, { accessMode: "registered" });
    expect(v1.version).toBe(1);
    const lookup1 = await getPublishedFormBySlug(v1.slug);
    if (lookup1.state !== "published") throw new Error("esperaba published");
    const v1Id = lookup1.form.versionId;

    await saveDraft(orgA.id, id, { draft: draftOf("CA01", [text("a", "Etiqueta nueva")]) });
    const v2 = await publishForm(orgA.id, userA, id, { accessMode: "registered" });
    expect(v2.version).toBe(2);

    const stored1 = await getFormVersion(v1Id);
    expect(stored1?.schema.fields[0]?.label).toBe("Etiqueta antigua");
    const lookup2 = await getPublishedFormBySlug(v2.slug);
    if (lookup2.state !== "published") throw new Error("esperaba published");
    expect(lookup2.form.version).toBe(2);
    expect(lookup2.form.schema.fields[0]?.label).toBe("Etiqueta nueva");
  });

  // Cubre: CA-PUB-03
  it("CA-PUB-03: las respuestas de v1 siguen siendo válidas con el esquema v1 tras una v2 con campo obligatorio nuevo", async () => {
    const id = await newForm("CA03");
    const v1 = await publishForm(orgA.id, userA, id, { accessMode: "registered" });
    const lookup1 = await getPublishedFormBySlug(v1.slug);
    if (lookup1.state !== "published") throw new Error("esperaba published");

    await saveDraft(orgA.id, id, {
      draft: draftOf("CA03", [text("a", "Etiqueta A"), text("b", "Nuevo obligatorio", true)]),
    });
    await publishForm(orgA.id, userA, id, { accessMode: "registered" });

    const stored1 = await getFormVersion(lookup1.form.versionId);
    expect(stored1).not.toBeNull();
    expect(FormVersionSchema.safeParse(stored1?.schema).success).toBe(true);
    expect(stored1?.schema.fields.map((f) => f.id)).toEqual(["a"]);
    const result = validateSubmission(stored1!.schema, { a: "hola" });
    expect(result.success).toBe(true);
  });

  // Cubre: CA-PUB-04
  it("CA-PUB-04: registered exige sesión de la organización; public no", async () => {
    const reg = await newForm("CA04 reg");
    const { slug } = await publishForm(orgA.id, userA, reg, { accessMode: "registered" });
    await expect(getFormForFilling(slug, null)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(getFormForFilling(slug, { organizationId: orgB.id })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect((await getFormForFilling(slug, { organizationId: orgA.id })).state).toBe("published");

    const pub = await newForm("CA04 pub");
    const published = await publishForm(orgA.id, userA, pub, { accessMode: "public" });
    expect((await getFormForFilling(published.slug, null)).state).toBe("published");
  });

  // Cubre: CA-PUB-05
  it("CA-PUB-05: publicar, despublicar y cambiar modo con la organización B lanza NotFoundError", async () => {
    const id = await newForm("CA05");
    await expect(publishForm(orgB.id, userA, id, { accessMode: "public" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(unpublishForm(orgB.id, id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(setFormAccessMode(orgB.id, id, { accessMode: "public" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(getPublishingState(orgB.id, id)).rejects.toBeInstanceOf(NotFoundError);
  });

  // Cubre: CA-PUB-06
  it("CA-PUB-06: despublicar cierra el enlace y republicar conserva el slug con versión 2", async () => {
    const id = await newForm("CA06");
    const first = await publishForm(orgA.id, userA, id, { accessMode: "public" });
    await unpublishForm(orgA.id, id);
    expect(await getPublishedFormBySlug(first.slug)).toEqual({ state: "closed" });
    // idempotente
    await unpublishForm(orgA.id, id);

    const state = await getPublishingState(orgA.id, id);
    expect(state).toMatchObject({ status: "draft", slug: first.slug, publishedVersion: 1 });

    const second = await publishForm(orgA.id, userA, id, { accessMode: "public" });
    expect(second.slug).toBe(first.slug);
    expect(second.version).toBe(2);
    expect((await getPublishedFormBySlug(first.slug)).state).toBe("published");
  });

  // Cubre: CA-PUB-07
  it("CA-PUB-07: un borrador sin campos no se publica y no crea versión", async () => {
    const id = await newForm("CA07", draftOf("CA07", []));
    const error = await publishForm(orgA.id, userA, id, { accessMode: "registered" }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PublishValidationError);
    expect((error as PublishValidationError).message).toBe(
      "El formulario necesita al menos un campo para publicarse.",
    );
    expect(await prisma.formVersion.count({ where: { formId: id } })).toBe(0);
    expect((await getPublishingState(orgA.id, id)).status).toBe("draft");
  });

  // Cubre: RF-PUB-09, RF-PUB-10
  it("RF-PUB-09: modo por defecto registered; cambiar el modo no crea versión; slug estable al renombrar", async () => {
    const id = await newForm("RF09");
    expect((await getPublishingState(orgA.id, id)).accessMode).toBe("registered");
    const { slug } = await publishForm(orgA.id, userA, id, { accessMode: "registered" });
    expect(isValidSlug(slug)).toBe(true);

    await setFormAccessMode(orgA.id, id, { accessMode: "public" });
    expect((await getPublishingState(orgA.id, id)).accessMode).toBe("public");
    expect(await prisma.formVersion.count({ where: { formId: id } })).toBe(1);

    await prisma.form.update({ where: { id }, data: { name: "Renombrado" } });
    expect((await getPublishingState(orgA.id, id)).slug).toBe(slug);
  });

  // Cubre: RF-PUB-10
  it("RF-PUB-10: archivar un formulario publicado lo cierra y un slug desconocido es NotFoundError", async () => {
    const id = await newForm("RF10");
    const { slug } = await publishForm(orgA.id, userA, id, { accessMode: "public" });
    await archiveForm(orgA.id, id);
    expect(await getPublishedFormBySlug(slug)).toEqual({ state: "closed" });
    await expect(getPublishedFormBySlug("zzzzzzzzzz")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getPublishedFormBySlug("no-valido")).rejects.toBeInstanceOf(NotFoundError);
  });

  // Cubre: RF-PUB-03
  it("RF-PUB-03: getFormVersion devuelve null si no existe", async () => {
    expect(await getFormVersion("inexistente")).toBeNull();
  });
});

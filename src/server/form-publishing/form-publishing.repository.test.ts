import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, type FormVersion as SchemaVersion } from "@/lib/form-schema";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import { createForm } from "@/server/forms/form.repository";
import * as repository from "./form-publishing.repository";
import {
  createVersionAndPublish,
  findFormBySlug,
  findFormForPublishing,
  findVersion,
  findVersionById,
  setAccessMode,
  setUnpublished,
} from "./form-publishing.repository";

// Requiere PostgreSQL accesible vía DATABASE_URL (ver specs/form-publishing/test-plan.md).

const schema: SchemaVersion = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  title: "T",
  fields: [{ id: "a", type: "text", label: "A", required: false, config: {} }],
};

function rndSlug(): string {
  return `t${Math.random().toString(36).slice(2, 11).padEnd(9, "x")}`;
}

describe("form-publishing.repository", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let formOfA: { id: string };

  beforeAll(async () => {
    orgA = await createOrganization({ name: "Org A (form-publishing.repository test)" });
    orgB = await createOrganization({ name: "Org B (form-publishing.repository test)" });
    formOfA = await createForm(orgA.id, { name: "Form A", draft: { title: "Form A", fields: [] } });
  });

  afterAll(async () => {
    const ids = [orgA.id, orgB.id];
    await prisma.formVersion.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.form.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.organization.deleteMany({ where: { id: { in: ids } } });
  });

  // Cubre: CA-PUB-05
  it("CA-PUB-05: con el organizationId de B ninguna función de administración ve ni cambia el form de A", async () => {
    expect(await findFormForPublishing(orgB.id, formOfA.id)).toBeNull();
    expect(
      await createVersionAndPublish(orgB.id, formOfA.id, {
        schema,
        accessMode: "public",
        slug: rndSlug(),
        userId: "u",
      }),
    ).toBeNull();
    expect(await setUnpublished(orgB.id, formOfA.id)).toBeNull();
    expect(await setAccessMode(orgB.id, formOfA.id, "public")).toBeNull();
    expect(await findVersion(orgB.id, formOfA.id, 1)).toBeNull();

    const untouched = await findFormForPublishing(orgA.id, formOfA.id);
    expect(untouched?.status).toBe("draft");
    expect(untouched?.accessMode).toBe("registered");
    expect(untouched?.slug).toBeNull();
    expect(await prisma.formVersion.count({ where: { formId: formOfA.id } })).toBe(0);
  });

  // Cubre: RF-PUB-01
  it("RF-PUB-01: el módulo no exporta funciones que actualicen o borren FormVersion", () => {
    const names = Object.keys(repository);
    expect(names.filter((n) => /^(update|delete|remove)/i.test(n))).toEqual([]);
  });

  // Cubre: RF-PUB-01, RF-PUB-02
  it("RF-PUB-01: version crece 1, 2, 3 y findVersion/findVersionById la devuelven", async () => {
    const form = await createForm(orgA.id, { name: "Seq", draft: { title: "Seq", fields: [] } });
    const slug = rndSlug();
    const numbers: number[] = [];
    for (let i = 0; i < 3; i++) {
      const result = await createVersionAndPublish(orgA.id, form.id, {
        schema: { ...schema, title: `v${i + 1}` },
        accessMode: "registered",
        slug,
        userId: "u",
      });
      numbers.push(result?.version.version ?? -1);
    }
    expect(numbers).toEqual([1, 2, 3]);

    const v1 = await findVersion(orgA.id, form.id, 1);
    expect(v1?.schema).toMatchObject({ title: "v1" });
    expect((await findVersionById(v1?.id ?? ""))?.version).toBe(1);
    const stored = await findFormBySlug(slug);
    expect(stored?.publishedVersion).toBe(3);
    expect(stored?.status).toBe("published");
  });

  // Cubre: RF-PUB-01, RF-PUB-04
  it("RF-PUB-01: dos publicaciones seguidas con slugs distintos dejan el primero", async () => {
    const form = await createForm(orgA.id, { name: "Slug", draft: { title: "Slug", fields: [] } });
    const first = rndSlug();
    const second = rndSlug();
    await createVersionAndPublish(orgA.id, form.id, { schema, accessMode: "registered", slug: first, userId: "u" });
    const result = await createVersionAndPublish(orgA.id, form.id, {
      schema,
      accessMode: "registered",
      slug: second,
      userId: "u",
    });
    expect(result?.form.slug).toBe(first);
    expect(await findFormBySlug(second)).toBeNull();
  });

  // Cubre: RF-PUB-04
  it("RF-PUB-04: un slug ya usado por otro formulario lanza SlugTakenError", async () => {
    const a = await createForm(orgA.id, { name: "S1", draft: { title: "S1", fields: [] } });
    const b = await createForm(orgA.id, { name: "S2", draft: { title: "S2", fields: [] } });
    const slug = rndSlug();
    await createVersionAndPublish(orgA.id, a.id, { schema, accessMode: "registered", slug, userId: "u" });
    await expect(
      createVersionAndPublish(orgA.id, b.id, { schema, accessMode: "registered", slug, userId: "u" }),
    ).rejects.toBeInstanceOf(repository.SlugTakenError);
  });

  // Cubre: RNF-PUB-03
  it("RNF-PUB-03: un formulario existente tiene valores por defecto compatibles", async () => {
    const form = await createForm(orgA.id, { name: "Def", draft: { title: "Def", fields: [] } });
    const found = await findFormForPublishing(orgA.id, form.id);
    expect(found).toMatchObject({ status: "draft", slug: null, accessMode: "registered", publishedVersion: null });
  });

  // Cubre: RF-COL-01
  it("RF-COL-01: listPublishedForms solo devuelve los publicados de la organización", async () => {
    const pub = await createForm(orgA.id, { name: "Listado pub", draft: { title: "L", fields: [] } });
    const slug = rndSlug();
    await createVersionAndPublish(orgA.id, pub.id, { schema, accessMode: "registered", slug, userId: "u" });
    const other = await createForm(orgB.id, { name: "Listado B", draft: { title: "L", fields: [] } });
    await createVersionAndPublish(orgB.id, other.id, {
      schema,
      accessMode: "registered",
      slug: rndSlug(),
      userId: "u",
    });
    await createForm(orgA.id, { name: "Listado borrador", draft: { title: "L", fields: [] } });

    const list = await repository.listPublishedForms(orgA.id);
    expect(list.map((f) => f.slug)).toContain(slug);
    expect(list.map((f) => f.id)).not.toContain(other.id);
    expect(list.every((f) => f.name !== "Listado borrador")).toBe(true);
  });
});

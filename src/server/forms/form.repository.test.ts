import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { createOrganization } from "@/server/auth/organization.repository";
import {
  archiveForm,
  createForm,
  findFormById,
  listFormsByOrganization,
  updateFormDraft,
  updateFormName,
} from "./form.repository";

// Requiere PostgreSQL accesible vía DATABASE_URL (ver specs/form-editor/test-plan.md).

describe("form.repository", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let formOfB: { id: string };

  beforeAll(async () => {
    orgA = await createOrganization({ name: "Organización A (form.repository test)" });
    orgB = await createOrganization({ name: "Organización B (form.repository test)" });
    formOfB = await createForm(orgB.id, { name: "Form de B", draft: { title: "Form de B", fields: [] } });
  });

  afterAll(async () => {
    await prisma.form.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  });

  // Cubre: aislamiento multi-tenant (RNF-EDT)
  it("archiveForm con el organizationId de otra organización devuelve null", async () => {
    expect(await archiveForm(orgA.id, formOfB.id)).toBeNull();
    expect((await findFormById(orgB.id, formOfB.id))?.archivedAt).toBeNull();
  });

  // Cubre: aislamiento multi-tenant (RNF-EDT)
  it("updateFormName y updateFormDraft devuelven null con otra organización", async () => {
    expect(await updateFormName(orgA.id, formOfB.id, "Hack")).toBeNull();
    expect(await updateFormDraft(orgA.id, formOfB.id, { title: "Hack", fields: [] })).toBeNull();
    expect((await findFormById(orgB.id, formOfB.id))?.name).toBe("Form de B");
  });

  // Cubre: aislamiento multi-tenant (RNF-EDT)
  it("findFormById y listFormsByOrganization no cruzan organizaciones", async () => {
    expect(await findFormById(orgA.id, formOfB.id)).toBeNull();
    expect(await listFormsByOrganization(orgA.id)).toEqual([]);
    expect((await listFormsByOrganization(orgB.id)).map((f) => f.id)).toEqual([formOfB.id]);
  });

  // Cubre: RF-PUB-01
  it("RF-PUB-01: etiquetas Sin publicar, v<n> y Despublicado (última v<n>)", async () => {
    const org = await createOrganization({ name: "Organización etiquetas (form.repository test)" });
    try {
      const draft = { title: "x", fields: [] };
      const sin = await createForm(org.id, { name: "Sin", draft });
      const pub = await createForm(org.id, { name: "Pub", draft });
      const des = await createForm(org.id, { name: "Des", draft });
      await prisma.form.update({ where: { id: pub.id }, data: { status: "published", publishedVersion: 2 } });
      await prisma.form.update({ where: { id: des.id }, data: { status: "draft", publishedVersion: 3 } });

      const labels = Object.fromEntries(
        (await listFormsByOrganization(org.id)).map((f) => [f.id, f.publishedVersionLabel]),
      );
      expect(labels[sin.id]).toBe("Sin publicar");
      expect(labels[pub.id]).toBe("v2");
      expect(labels[des.id]).toBe("Despublicado (última v3)");
    } finally {
      await prisma.form.deleteMany({ where: { organizationId: org.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    }
  });

  // Cubre: CA-EDT-15
  it("CA-EDT-15: responseCount cuenta las respuestas de la organización y no las de otra", async () => {
    const org = await createOrganization({ name: "Organización recuento A (form.repository test)" });
    const other = await createOrganization({ name: "Organización recuento B (form.repository test)" });
    try {
      const draft = { title: "x", fields: [] };
      const withThree = await createForm(org.id, { name: "Con 3", draft });
      const empty = await createForm(org.id, { name: "Con 0", draft });
      const base = {
        formTitle: "x",
        formVersionSnapshot: {},
        answers: {},
        capturedAt: new Date(),
      };
      await prisma.submission.createMany({
        data: [1, 2, 3].map((n) => ({
          ...base,
          organizationId: org.id,
          formId: withThree.id,
          clientId: `${withThree.id}-${n}`,
        })),
      });
      // Respuestas de otra organización, incluso con el mismo formId, no cuentan.
      await prisma.submission.createMany({
        data: [1, 2].map((n) => ({
          ...base,
          organizationId: other.id,
          formId: withThree.id,
          clientId: `${withThree.id}-other-${n}`,
        })),
      });

      const counts = Object.fromEntries(
        (await listFormsByOrganization(org.id)).map((f) => [f.id, f.responseCount]),
      );
      expect(counts[withThree.id]).toBe(3);
      expect(counts[empty.id]).toBe(0);
    } finally {
      await prisma.submission.deleteMany({ where: { organizationId: { in: [org.id, other.id] } } });
      await prisma.form.deleteMany({ where: { organizationId: org.id } });
      await prisma.organization.deleteMany({ where: { id: { in: [org.id, other.id] } } });
    }
  });

  // Cubre: CA-EDT-06
  it("un formulario archivado desaparece del listado", async () => {
    const f = await createForm(orgA.id, { name: "A1", draft: { title: "A1", fields: [] } });
    expect(await archiveForm(orgA.id, f.id)).not.toBeNull();
    expect(await listFormsByOrganization(orgA.id)).toEqual([]);
  });
});

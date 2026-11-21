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

  // Cubre: CA-EDT-06
  it("un formulario archivado desaparece del listado", async () => {
    const f = await createForm(orgA.id, { name: "A1", draft: { title: "A1", fields: [] } });
    expect(await archiveForm(orgA.id, f.id)).not.toBeNull();
    expect(await listFormsByOrganization(orgA.id)).toEqual([]);
  });
});

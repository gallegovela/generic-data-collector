import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { createOrganization } from "./organization.repository";
import { createUser, findUserById, updateUserStatus } from "./user.repository";

// Requiere una base de datos PostgreSQL accesible vía DATABASE_URL
// (ver "Preparación" en specs/tenancy-auth/test-plan.md).

describe("user.repository", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let userOfOrgB: { id: string };

  beforeAll(async () => {
    orgA = await createOrganization({ name: "Organización A (test)" });
    orgB = await createOrganization({ name: "Organización B (test)" });
    userOfOrgB = await createUser(orgB.id, {
      email: `user-org-b-${Date.now()}@test.formia.local`,
      name: "Usuario B",
      role: "collector",
      passwordHash: "hash",
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  });

  // Cubre: CA-AUT-01, RF-AUT-07
  it("findUserById devuelve null si el usuario pertenece a otra organización", async () => {
    const result = await findUserById(orgA.id, userOfOrgB.id);

    expect(result).toBeNull();
  });

  // Cubre: CA-AUT-01, RF-AUT-07
  it("findUserById devuelve el usuario si pertenece a la organización indicada", async () => {
    const result = await findUserById(orgB.id, userOfOrgB.id);

    expect(result?.id).toBe(userOfOrgB.id);
  });

  // Cubre: CA-AUT-01, RF-AUT-07
  it("updateUserStatus devuelve null si el usuario pertenece a otra organización", async () => {
    const result = await updateUserStatus(orgA.id, userOfOrgB.id, "inactive");

    expect(result).toBeNull();

    const unchanged = await findUserById(orgB.id, userOfOrgB.id);
    expect(unchanged?.status).toBe("active");
  });

  // Cubre: CA-AUT-01, RF-AUT-07
  it("updateUserStatus actualiza el estado dentro de la misma organización", async () => {
    const result = await updateUserStatus(orgB.id, userOfOrgB.id, "inactive");

    expect(result?.status).toBe("inactive");
  });
});

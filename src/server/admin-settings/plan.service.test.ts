import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";

// Permite simular que solo queda un plan (la BD compartida siempre tiene más).
const override = vi.hoisted(() => ({ count: null as number | null }));
vi.mock("./plan.repository", async (importOriginal) => {
  const original = await importOriginal<typeof import("./plan.repository")>();
  return { ...original, countPlans: async () => override.count ?? original.countPlans() };
});

import { ensureGenericPlan } from "./test-helpers";
import { assignPlanToOrganization, createNewPlan, removePlan, updateExistingPlan } from "./plan.service";

const admin = { role: "admin" as const };
const input = (name: string) => ({ name, maxImpressionsPerHour: null, maxSubmissionsPerHour: 5, maxFileBytes: null });

describe("plan.service", () => {
  const planIds: string[] = [];
  const orgIds: string[] = [];
  const uniq = () => `Plan test ${randomUUID()}`;

  async function newPlan() {
    const plan = await createNewPlan(admin, input(uniq()));
    planIds.push(plan.id);
    return plan;
  }

  beforeAll(ensureGenericPlan);

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.plan.deleteMany({ where: { id: { in: planIds } } });
  });

  it("un collector no gestiona planes", async () => {
    await expect(createNewPlan({ role: "collector" }, input(uniq()))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("crea y edita un plan; el nombre duplicado da ConflictError", async () => {
    const plan = await newPlan();
    const updated = await updateExistingPlan(admin, plan.id, { ...input(plan.name), maxSubmissionsPerHour: 9 });
    expect(updated.maxSubmissionsPerHour).toBe(9);
    await expect(createNewPlan(admin, input(plan.name))).rejects.toBeInstanceOf(ConflictError);
    await expect(updateExistingPlan(admin, "no-existe", input(uniq()))).rejects.toBeInstanceOf(NotFoundError);
  });

  // Cubre: CA-SET-09
  describe("borrado de planes", () => {
    it("un plan con organizaciones lanza ConflictError", async () => {
      const plan = await newPlan();
      const org = await createOrganization({ name: "Org borrado (plan.service test)", planId: plan.id });
      orgIds.push(org.id);
      await expect(removePlan(admin, plan.id)).rejects.toBeInstanceOf(ConflictError);
      expect(await prisma.plan.count({ where: { id: plan.id } })).toBe(1);
    });

    it("el último plan lanza ConflictError", async () => {
      const plan = await newPlan();
      override.count = 1;
      try {
        await expect(removePlan(admin, plan.id)).rejects.toThrow("No se puede borrar el último plan.");
      } finally {
        override.count = null;
      }
      expect(await prisma.plan.count({ where: { id: plan.id } })).toBe(1);
    });

    it("un plan libre se elimina y uno inexistente da NotFoundError", async () => {
      const plan = await newPlan();
      await removePlan(admin, plan.id);
      expect(await prisma.plan.count({ where: { id: plan.id } })).toBe(0);
      await expect(removePlan(admin, plan.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  // Cubre: CA-SET-10
  describe("asignación de plan", () => {
    it("cambia solo la organización del usuario", async () => {
      const plan = await newPlan();
      const a = await createOrganization({ name: "Org A (asignación)" });
      const b = await createOrganization({ name: "Org B (asignación)" });
      orgIds.push(a.id, b.id);
      await assignPlanToOrganization({ ...admin, organizationId: a.id }, plan.id);
      expect((await prisma.organization.findUnique({ where: { id: a.id } }))?.planId).toBe(plan.id);
      expect((await prisma.organization.findUnique({ where: { id: b.id } }))?.planId).toBe("plan-generic");
    });

    it("un plan inexistente lanza NotFoundError", async () => {
      const org = await createOrganization({ name: "Org C (asignación)" });
      orgIds.push(org.id);
      await expect(
        assignPlanToOrganization({ ...admin, organizationId: org.id }, "no-existe"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";

const session = vi.hoisted(() => ({ user: null as null | { id: string; organizationId: string; role: "admin" | "collector" } }));
vi.mock("@/server/auth/session", async () => ({
  requireSession: async (options?: { role?: string }) => {
    const { UnauthorizedError, ForbiddenError } = await import("@/lib/errors");
    if (!session.user) throw new UnauthorizedError();
    if (options?.role && session.user.role !== options.role) throw new ForbiddenError();
    return session.user;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { assignPlanAction, createPlanAction, deletePlanAction, updatePlanAction } from "./plan.actions";
import { ensureGenericPlan } from "./test-helpers";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

describe("plan.actions", () => {
  const name = `Plan actions ${randomUUID()}`;
  let orgId: string;

  beforeAll(async () => {
    await ensureGenericPlan();
    orgId = (await createOrganization({ name: "Org (plan.actions test)" })).id;
  });

  beforeEach(() => {
    session.user = null;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.plan.deleteMany({ where: { name: { startsWith: "Plan actions " } } });
  });

  // Cubre: CA-SET-01
  describe("acceso de ajustes", () => {
    it("sin sesión las acciones lanzan UnauthorizedError y no crean nada", async () => {
      await expect(createPlanAction(undefined, form({ name }))).rejects.toBeInstanceOf(UnauthorizedError);
      await expect(updatePlanAction(undefined, form({ planId: "plan-generic", name: "X" }))).rejects.toBeInstanceOf(UnauthorizedError);
      await expect(deletePlanAction(undefined, form({ planId: "plan-generic" }))).rejects.toBeInstanceOf(UnauthorizedError);
      await expect(assignPlanAction(undefined, form({ planId: "plan-generic" }))).rejects.toBeInstanceOf(UnauthorizedError);
      expect(await prisma.plan.count({ where: { name } })).toBe(0);
    });

    it("con collector lanzan ForbiddenError y no modifican planes", async () => {
      session.user = { id: "u", organizationId: orgId, role: "collector" };
      await expect(createPlanAction(undefined, form({ name }))).rejects.toBeInstanceOf(ForbiddenError);
      await expect(assignPlanAction(undefined, form({ planId: "plan-generic" }))).rejects.toBeInstanceOf(ForbiddenError);
      expect(await prisma.plan.count({ where: { name } })).toBe(0);
    });

    it("con admin crea, edita y borra un plan, con validación", async () => {
      session.user = { id: "u", organizationId: orgId, role: "admin" };
      expect(await createPlanAction(undefined, form({ name, maxSubmissionsPerHour: "0" }))).toHaveProperty("error");
      expect(await createPlanAction(undefined, form({ name, maxSubmissionsPerHour: "7", maxFileMb: "0,5" }))).toEqual({ ok: true });
      const plan = await prisma.plan.findUniqueOrThrow({ where: { name } });
      expect(plan).toMatchObject({ maxSubmissionsPerHour: 7, maxImpressionsPerHour: null, maxFileBytes: 524288 });
      expect(await updatePlanAction(undefined, form({ planId: plan.id, name, maxSubmissionsPerHour: "" }))).toEqual({ ok: true });
      expect((await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).maxSubmissionsPerHour).toBeNull();
      expect(await deletePlanAction(undefined, form({ planId: plan.id }))).toEqual({ ok: true });
    });
  });

  // Cubre: CA-SET-10
  describe("asignación de plan", () => {
    it("asigna el plan a la organización de la sesión, ignorando campos externos", async () => {
      session.user = { id: "u", organizationId: orgId, role: "admin" };
      const other = await createOrganization({ name: "Otra org (plan.actions test)" });
      try {
        const plan = await prisma.plan.create({ data: { name: `Plan actions ${randomUUID()}` } });
        await assignPlanAction(undefined, form({ planId: plan.id, organizationId: other.id }));
        expect((await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })).planId).toBe(plan.id);
        expect((await prisma.organization.findUniqueOrThrow({ where: { id: other.id } })).planId).toBe("plan-generic");
        expect(await assignPlanAction(undefined, form({ planId: "no-existe" }))).toHaveProperty("error");
      } finally {
        await prisma.organization.deleteMany({ where: { id: other.id } });
      }
    });
  });
});

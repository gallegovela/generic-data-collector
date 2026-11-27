import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PlanLimitError } from "@/lib/errors";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import { ensureGenericPlan } from "./test-helpers";
import { assertUsage, consumeUsage, getEffectiveLimits, getUsage, refundUsage } from "./usage-limits.service";

// Requiere PostgreSQL (npm run test:stack:run -- npm test).
const HOUR = new Date("2026-03-10T10:30:00Z");
const NEXT_HOUR = new Date("2026-03-10T11:00:00Z");

describe("usage-limits.service", () => {
  const planIds: string[] = [];
  const orgIds: string[] = [];

  async function setup(limits: { i?: number | null; s?: number | null; f?: number | null }) {
    const plan = await prisma.plan.create({
      data: {
        name: `Plan test ${randomUUID()}`,
        maxImpressionsPerHour: limits.i ?? null,
        maxSubmissionsPerHour: limits.s ?? null,
        maxFileBytes: limits.f ?? null,
      },
    });
    const org = await createOrganization({ name: `Org usage (${plan.name})`, planId: plan.id });
    planIds.push(plan.id);
    orgIds.push(org.id);
    return { plan, org };
  }

  beforeAll(ensureGenericPlan);

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.plan.deleteMany({ where: { id: { in: planIds } } });
  });

  it("getEffectiveLimits devuelve los límites del plan", async () => {
    const { plan, org } = await setup({ i: 3, s: 2, f: 100 });
    expect(await getEffectiveLimits(org.id)).toEqual({
      planId: plan.id,
      planName: plan.name,
      maxImpressionsPerHour: 3,
      maxSubmissionsPerHour: 2,
      maxFileBytes: 100,
    });
  });

  // Cubre: CA-SET-08
  describe("límite de impresiones", () => {
    it("la cuarta impresión con límite 3 no se permite", async () => {
      const { org } = await setup({ i: 3 });
      for (let n = 1; n <= 3; n++) {
        expect(await consumeUsage(org.id, "f1", "impression", HOUR)).toEqual({ allowed: true, used: n, limit: 3 });
      }
      expect(await consumeUsage(org.id, "f1", "impression", HOUR)).toEqual({ allowed: false, used: 3, limit: 3 });
      expect(await getUsage(org.id, "f1", "impression", HOUR)).toEqual({ used: 3, limit: 3 });
    });

    it("assertUsage lanza PlanLimitError con limit impressions", async () => {
      const { org } = await setup({ i: 1 });
      await assertUsage(org.id, "f1", "impression", HOUR);
      const err = await assertUsage(org.id, "f1", "impression", HOUR).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PlanLimitError);
      expect((err as PlanLimitError).limit).toBe("impressions");
    });
  });

  // Cubre: CA-SET-05
  describe("sin límite", () => {
    it("con límites nulos 50 consumos seguidos se permiten", async () => {
      const { org } = await setup({});
      for (let n = 0; n < 50; n++) {
        const r = await consumeUsage(org.id, "f1", "submission", HOUR);
        expect(r.allowed).toBe(true);
      }
      expect(await getUsage(org.id, "f1", "submission", HOUR)).toEqual({ used: 50, limit: null });
    });
  });

  // Cubre: CA-SET-06
  describe("aislamiento de contadores", () => {
    it("agotar una organización no afecta a otra ni a otro formulario", async () => {
      const a = await setup({ s: 1 });
      const b = await setup({ s: 1 });
      expect((await consumeUsage(a.org.id, "f1", "submission", HOUR)).allowed).toBe(true);
      expect((await consumeUsage(a.org.id, "f1", "submission", HOUR)).allowed).toBe(false);
      expect((await consumeUsage(b.org.id, "f1", "submission", HOUR)).allowed).toBe(true);
      expect((await consumeUsage(a.org.id, "f2", "submission", HOUR)).allowed).toBe(true);
    });

    it("en la hora siguiente el cupo vuelve a estar libre y refundUsage devuelve cupo", async () => {
      const { org } = await setup({ s: 1 });
      expect((await consumeUsage(org.id, "f1", "submission", HOUR)).allowed).toBe(true);
      expect((await consumeUsage(org.id, "f1", "submission", HOUR)).allowed).toBe(false);
      expect((await consumeUsage(org.id, "f1", "submission", NEXT_HOUR)).allowed).toBe(true);
      await refundUsage(org.id, "f1", "submission", HOUR);
      expect((await consumeUsage(org.id, "f1", "submission", HOUR)).allowed).toBe(true);
    });
  });

  // Cubre: CA-SET-11
  describe("concurrencia", () => {
    it("20 consumos en paralelo con límite 5 permiten exactamente 5", async () => {
      const { org } = await setup({ s: 5 });
      const results = await Promise.all(
        Array.from({ length: 20 }, () => consumeUsage(org.id, "f1", "submission", HOUR)),
      );
      expect(results.filter((r) => r.allowed)).toHaveLength(5);
      expect(results.filter((r) => !r.allowed)).toHaveLength(15);
      const row = await prisma.usageCounter.findFirst({ where: { organizationId: org.id, formId: "f1" } });
      expect(row?.count).toBe(5);
    });
  });
});

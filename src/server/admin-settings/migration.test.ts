import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { ensureGenericPlan } from "./test-helpers";

// Requiere PostgreSQL (npm run test:stack:run -- npm test).
describe("migración y plan genérico", () => {
  // Cubre: CA-SET-07, RF-SET-07
  it("plan genérico existe con los límites por defecto", async () => {
    await ensureGenericPlan();
    const plan = await prisma.plan.findUnique({ where: { id: "plan-generic" } });
    expect(plan).toMatchObject({
      name: "Genérico",
      maxImpressionsPerHour: 10000,
      maxSubmissionsPerHour: 1000,
      maxFileBytes: 10485760,
    });
  });

  it("plan genérico: ninguna organización queda sin plan y el upsert es idempotente", async () => {
    await ensureGenericPlan();
    await ensureGenericPlan();
    expect(await prisma.plan.count({ where: { id: "plan-generic" } })).toBe(1);
    const orgs = await prisma.organization.findMany({ select: { planId: true } });
    expect(orgs.every((o) => typeof o.planId === "string" && o.planId.length > 0)).toBe(true);
  });
});

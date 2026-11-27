import { DEFAULT_PLAN_ID } from "@/lib/admin-settings/plan.schema";
import { prisma } from "@/server/db/client";

/** Solo para tests: garantiza que existe el plan «Genérico». */
export async function ensureGenericPlan(): Promise<void> {
  await prisma.plan.upsert({
    where: { id: DEFAULT_PLAN_ID },
    update: {},
    create: {
      id: DEFAULT_PLAN_ID,
      name: "Genérico",
      maxImpressionsPerHour: 10000,
      maxSubmissionsPerHour: 1000,
      maxFileBytes: 10485760,
    },
  });
}

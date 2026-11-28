import { Prisma, type Plan } from "@prisma/client";
import { ConflictError } from "@/lib/errors";
import type { PlanInput } from "@/lib/admin-settings/plan.schema";
import { prisma } from "@/server/db/client";

// Los planes son globales: única excepción a «toda consulta filtra por organizationId».

export type PlanRecord = Plan;
export type PlanWithUsage = PlanRecord & { organizationCount: number };

const NAME_TAKEN = "Ya existe un plan con ese nombre.";

function errorCode(error: unknown): string | null {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
}

export async function listPlans(): Promise<PlanWithUsage[]> {
  const plans = await prisma.plan.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { organizations: true } } },
  });
  return plans.map(({ _count, ...plan }) => ({ ...plan, organizationCount: _count.organizations }));
}

export function findPlanById(id: string): Promise<PlanRecord | null> {
  return prisma.plan.findUnique({ where: { id } });
}

export async function findPlanByOrganization(organizationId: string): Promise<PlanRecord | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });
  return org?.plan ?? null;
}

export async function createPlan(data: PlanInput): Promise<PlanRecord> {
  try {
    return await prisma.plan.create({ data });
  } catch (error) {
    if (errorCode(error) === "P2002") throw new ConflictError(NAME_TAKEN);
    throw error;
  }
}

export async function updatePlan(id: string, data: PlanInput): Promise<PlanRecord | null> {
  try {
    return await prisma.plan.update({ where: { id }, data });
  } catch (error) {
    const code = errorCode(error);
    if (code === "P2002") throw new ConflictError(NAME_TAKEN);
    if (code === "P2025") return null;
    throw error;
  }
}

export function countPlans(): Promise<number> {
  return prisma.plan.count();
}

export function countOrganizationsOnPlan(planId: string): Promise<number> {
  return prisma.organization.count({ where: { planId } });
}

export async function deletePlan(id: string): Promise<boolean> {
  try {
    await prisma.plan.delete({ where: { id } });
    return true;
  } catch (error) {
    const code = errorCode(error);
    if (code === "P2003") throw new ConflictError("No se puede borrar un plan asignado a organizaciones.");
    if (code === "P2025") return false;
    throw error;
  }
}

export async function setOrganizationPlan(organizationId: string, planId: string): Promise<void> {
  await prisma.organization.update({ where: { id: organizationId }, data: { planId } });
}

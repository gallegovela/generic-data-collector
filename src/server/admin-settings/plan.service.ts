import type { Role } from "@prisma/client";
import type { PlanInput } from "@/lib/admin-settings/plan.schema";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  countOrganizationsOnPlan,
  countPlans,
  createPlan,
  deletePlan,
  findPlanById,
  listPlans,
  setOrganizationPlan,
  updatePlan,
  type PlanRecord,
  type PlanWithUsage,
} from "./plan.repository";

/**
 * Único punto a sustituir por un rol de plataforma cuando exista
 * (los planes son globales; hoy cualquier admin los edita).
 * Cubre: RF-SET-01
 */
export function assertCanManagePlans(user: { role: Role }): void {
  if (user.role !== "admin") throw new ForbiddenError();
}

export function listAllPlans(): Promise<PlanWithUsage[]> {
  return listPlans();
}

/** Cubre: RF-SET-03 */
export async function createNewPlan(user: { role: Role }, input: PlanInput): Promise<PlanRecord> {
  assertCanManagePlans(user);
  return createPlan(input);
}

/** Cubre: RF-SET-03 */
export async function updateExistingPlan(
  user: { role: Role },
  id: string,
  input: PlanInput,
): Promise<PlanRecord> {
  assertCanManagePlans(user);
  const updated = await updatePlan(id, input);
  if (!updated) throw new NotFoundError("No se ha encontrado el plan.");
  return updated;
}

/** Cubre: RF-SET-05 */
export async function removePlan(user: { role: Role }, id: string): Promise<void> {
  assertCanManagePlans(user);
  if (!(await findPlanById(id))) throw new NotFoundError("No se ha encontrado el plan.");
  if ((await countOrganizationsOnPlan(id)) > 0) {
    throw new ConflictError("No se puede borrar un plan asignado a organizaciones.");
  }
  if ((await countPlans()) <= 1) throw new ConflictError("No se puede borrar el último plan.");
  if (!(await deletePlan(id))) throw new NotFoundError("No se ha encontrado el plan.");
}

/** Asigna a la organización del usuario (nunca a una externa). Cubre: RF-SET-06 */
export async function assignPlanToOrganization(
  user: { role: Role; organizationId: string },
  planId: string,
): Promise<void> {
  assertCanManagePlans(user);
  if (!(await findPlanById(planId))) throw new NotFoundError("No se ha encontrado el plan.");
  await setOrganizationPlan(user.organizationId, planId);
}

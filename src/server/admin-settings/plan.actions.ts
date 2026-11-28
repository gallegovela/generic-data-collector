"use server";

import { revalidatePath } from "next/cache";
import { mbToBytes, planIdSchema, planInputSchema } from "@/lib/admin-settings/plan.schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { requireSession } from "@/server/auth/session";
import {
  assignPlanToOrganization,
  createNewPlan,
  removePlan,
  updateExistingPlan,
} from "./plan.service";

export type PlanActionState = { error?: string; ok?: true };

function toLimit(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return Number(value);
}

function parseInput(formData: FormData) {
  const maxFileMb = formData.get("maxFileMb");
  return planInputSchema.safeParse({
    name: formData.get("name"),
    maxImpressionsPerHour: toLimit(formData.get("maxImpressionsPerHour")),
    maxSubmissionsPerHour: toLimit(formData.get("maxSubmissionsPerHour")),
    maxFileBytes: mbToBytes(typeof maxFileMb === "string" ? maxFileMb : null),
  });
}

async function run(work: () => Promise<void>): Promise<PlanActionState> {
  try {
    await work();
    revalidatePath("/admin/settings/plans");
    return { ok: true };
  } catch (error) {
    if (error instanceof ConflictError || error instanceof NotFoundError) {
      return { error: error.message };
    }
    throw error;
  }
}

/** Cubre: RF-SET-01, RF-SET-03 */
export async function createPlanAction(
  _prev: PlanActionState | undefined,
  formData: FormData,
): Promise<PlanActionState> {
  const user = await requireSession({ role: "admin" });
  const parsed = parseInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  return run(async () => {
    await createNewPlan(user, parsed.data);
  });
}

/** Cubre: RF-SET-01, RF-SET-04 */
export async function updatePlanAction(
  _prev: PlanActionState | undefined,
  formData: FormData,
): Promise<PlanActionState> {
  const user = await requireSession({ role: "admin" });
  const id = planIdSchema.safeParse(formData.get("planId"));
  if (!id.success) return { error: "Falta el plan." };
  const parsed = parseInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  return run(async () => {
    await updateExistingPlan(user, id.data, parsed.data);
  });
}

/** Cubre: RF-SET-01, RF-SET-05 */
export async function deletePlanAction(
  _prev: PlanActionState | undefined,
  formData: FormData,
): Promise<PlanActionState> {
  const user = await requireSession({ role: "admin" });
  const id = planIdSchema.safeParse(formData.get("planId"));
  if (!id.success) return { error: "Falta el plan." };
  return run(() => removePlan(user, id.data));
}

/** Cubre: RF-SET-01, RF-SET-06 */
export async function assignPlanAction(
  _prev: PlanActionState | undefined,
  formData: FormData,
): Promise<PlanActionState> {
  const user = await requireSession({ role: "admin" });
  const id = planIdSchema.safeParse(formData.get("planId"));
  if (!id.success) return { error: "Falta el plan." };
  return run(() => assignPlanToOrganization(user, id.data));
}

import { currentWindowStart } from "@/lib/admin-settings/usage-window";
import { NotFoundError, PlanLimitError } from "@/lib/errors";
import { findPlanByOrganization } from "./plan.repository";
import { decrementUsage, getUsageCount, incrementUsage } from "./usage.repository";

export type UsageKindName = "impression" | "submission";

export type EffectiveLimits = {
  planId: string;
  planName: string;
  maxImpressionsPerHour: number | null;
  maxSubmissionsPerHour: number | null;
  maxFileBytes: number | null;
};

export type ConsumeResult =
  | { allowed: true; used: number; limit: number | null }
  | { allowed: false; used: number; limit: number };

/** Cubre: RF-SET-09 */
export async function getEffectiveLimits(organizationId: string): Promise<EffectiveLimits> {
  const plan = await findPlanByOrganization(organizationId);
  if (!plan) throw new NotFoundError("No se ha encontrado la organización.");
  return {
    planId: plan.id,
    planName: plan.name,
    maxImpressionsPerHour: plan.maxImpressionsPerHour,
    maxSubmissionsPerHour: plan.maxSubmissionsPerHour,
    maxFileBytes: plan.maxFileBytes,
  };
}

function limitFor(limits: EffectiveLimits, kind: UsageKindName): number | null {
  return kind === "impression" ? limits.maxImpressionsPerHour : limits.maxSubmissionsPerHour;
}

/** Cubre: RF-SET-08, RF-SET-09, RF-SET-10, RF-SET-13 */
export async function consumeUsage(
  organizationId: string,
  formId: string,
  kind: UsageKindName,
  now?: Date,
): Promise<ConsumeResult> {
  const limit = limitFor(await getEffectiveLimits(organizationId), kind);
  const windowStart = currentWindowStart(now ?? new Date());
  const used = await incrementUsage({ organizationId, formId, kind, windowStart, limit });
  if (used === null) return { allowed: false, used: limit as number, limit: limit as number };
  return { allowed: true, used, limit };
}

export async function assertUsage(
  organizationId: string,
  formId: string,
  kind: UsageKindName,
  now?: Date,
): Promise<void> {
  const result = await consumeUsage(organizationId, formId, kind, now);
  if (!result.allowed) throw new PlanLimitError(kind === "impression" ? "impressions" : "submissions");
}

export function refundUsage(
  organizationId: string,
  formId: string,
  kind: UsageKindName,
  now?: Date,
): Promise<void> {
  return decrementUsage({ organizationId, formId, kind, windowStart: currentWindowStart(now ?? new Date()) });
}

export async function getUsage(
  organizationId: string,
  formId: string,
  kind: UsageKindName,
  now?: Date,
): Promise<{ used: number; limit: number | null }> {
  const limit = limitFor(await getEffectiveLimits(organizationId), kind);
  const used = await getUsageCount({
    organizationId,
    formId,
    kind,
    windowStart: currentWindowStart(now ?? new Date()),
  });
  return { used, limit };
}

import { PlansManager } from "@/components/admin-settings/plans-manager";
import { listAllPlans } from "@/server/admin-settings/plan.service";
import { getEffectiveLimits } from "@/server/admin-settings/usage-limits.service";
import { requireSession } from "@/server/auth/session";

export default async function PlansPage() {
  const user = await requireSession({ role: "admin" });
  const [plans, current] = await Promise.all([listAllPlans(), getEffectiveLimits(user.organizationId)]);

  return (
    <PlansManager
      currentPlanId={current.planId}
      plans={plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        maxImpressionsPerHour: plan.maxImpressionsPerHour,
        maxSubmissionsPerHour: plan.maxSubmissionsPerHour,
        maxFileBytes: plan.maxFileBytes,
        organizationCount: plan.organizationCount,
      }))}
    />
  );
}

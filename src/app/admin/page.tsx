import { SubmissionStats } from "@/components/submissions-dashboard/submission-stats";
import { requireAdminPage } from "@/server/auth/session";
import { getHomeStats } from "@/server/submissions/submission.service";

export const dynamic = "force-dynamic";

/** Panel de inicio con contadores de respuestas. Cubre: RF-SUB-10, CA-SUB-06 */
export default async function AdminHomePage() {
  const user = await requireAdminPage();
  const stats = await getHomeStats(user.organizationId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Panel</h1>
      <SubmissionStats stats={stats} />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmissionDetail } from "@/components/submissions-dashboard/submission-detail";
import { NotFoundError } from "@/lib/errors";
import { requireAdminPage } from "@/server/auth/session";
import { getSubmissionDetail } from "@/server/submissions/submission.service";

export const dynamic = "force-dynamic";

/** Ficha de detalle de una respuesta (solo lectura). Cubre: RF-SUB-08, CA-SUB-07 */
export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const user = await requireAdminPage();
  const { id, submissionId } = await params;

  let submission;
  try {
    submission = await getSubmissionDetail(user.organizationId, submissionId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  // La ficha debe pertenecer al formulario de la URL.
  if (submission.formId !== id) notFound();

  return (
    <div className="space-y-4">
      <Link href={`/admin/forms/${id}/submissions`} className="text-sm underline">
        ← Volver al listado
      </Link>
      <SubmissionDetail submission={submission} />
    </div>
  );
}

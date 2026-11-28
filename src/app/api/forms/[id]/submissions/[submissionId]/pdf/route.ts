import { NextResponse, type NextRequest } from "next/server";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { resolveBaseUrl } from "@/lib/outputs/base-url";
import { requireSession } from "@/server/auth/session";
import { getSubmissionPdfForDownload } from "@/server/outputs/submission-pdf.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number): Response {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Descarga del PDF de una respuesta; solo administradores.
 *
 * Cubre: RF-OUT-04, CA-OUT-09, CA-OUT-12
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> },
): Promise<Response> {
  try {
    const user = await requireSession({ role: "admin" });
    const { id, submissionId } = await params;
    const { filename, buffer } = await getSubmissionPdfForDownload(
      user.organizationId,
      id,
      submissionId,
      resolveBaseUrl(request),
    );
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse(error.message, 401);
    if (error instanceof ForbiddenError) return errorResponse(error.message, 403);
    if (error instanceof NotFoundError) return errorResponse("No se ha encontrado la respuesta.", 404);
    throw error;
  }
}

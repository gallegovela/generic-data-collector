import { NextResponse, type NextRequest } from "next/server";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { resolveBaseUrl } from "@/lib/outputs/base-url";
import { submissionExportQuerySchema } from "@/lib/outputs/export-query.schema";
import { requireSession } from "@/server/auth/session";
import { exportSubmissions } from "@/server/outputs/export.service";

export const dynamic = "force-dynamic";

const KEYS = ["format", "dateFrom", "dateTo", "submittedBy", "fieldId", "fieldValue", "q"] as const;

function errorResponse(message: string, status: number): Response {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Descarga de respuestas en xlsx o CSV; solo administradores.
 *
 * Cubre: RF-OUT-05, RF-OUT-11, CA-OUT-06
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireSession({ role: "admin" });
    const { id } = await params;

    const raw: Record<string, string | undefined> = {};
    for (const key of KEYS) {
      const value = request.nextUrl.searchParams.get(key);
      raw[key] = value === null || value === "" ? undefined : value;
    }
    const parsed = submissionExportQuerySchema.safeParse(raw);
    if (!parsed.success) return errorResponse("Parámetros no válidos.", 400);

    const result = await exportSubmissions(
      user.organizationId,
      id,
      parsed.data,
      resolveBaseUrl(request),
    );
    // Solo identificadores y recuento: nunca contenido de respuestas.
    console.info(`export: form=${id} rows=${result.rowCount}`);

    return new Response(new Uint8Array(result.body), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse(error.message, 401);
    if (error instanceof ForbiddenError) return errorResponse(error.message, 403);
    if (error instanceof NotFoundError) return errorResponse("No se ha encontrado el formulario.", 404);
    if (error instanceof ValidationError) return errorResponse(error.message, 400);
    throw error;
  }
}

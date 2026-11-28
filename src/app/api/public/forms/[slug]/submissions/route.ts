import { PayloadTooLargeError, ValidationError } from "@/lib/errors";
import { fillSubmissionBodySchema } from "@/lib/field-collector/fill.schema";
import { MAX_SUBMISSION_ANSWERS_BYTES } from "@/lib/submissions-dashboard/create-submission.schema";
import { getCurrentUser } from "@/server/auth/session";
import { assertWithinFillLimit, clientIp } from "@/server/field-collector/fill-rate-limit";
import { submitFill } from "@/server/field-collector/fill.service";
import { jsonResponse, toErrorResponse } from "@/server/field-collector/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = MAX_SUBMISSION_ANSWERS_BYTES + 16 * 1024;

/**
 * Guarda la respuesta de un formulario publicado (idempotente por clientId).
 *
 * Cubre: RF-COL-08, RF-COL-13, RF-COL-17, RF-COL-19
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  try {
    const { slug } = await params;
    const user = await getCurrentUser();
    if (!user) assertWithinFillLimit("submit", slug, clientIp(request.headers));

    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > MAX_BODY_BYTES) throw new PayloadTooLargeError();

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      throw new ValidationError("Cuerpo JSON no válido.");
    }
    const body = fillSubmissionBodySchema.parse(json);

    const result = await submitFill(slug, user, body);
    // Honeypot: se responde como si se hubiera guardado.
    if (result.id === "") return jsonResponse({ id: "", created: true }, 201);
    return jsonResponse(result, result.created ? 201 : 200);
  } catch (error) {
    return toErrorResponse(error);
  }
}

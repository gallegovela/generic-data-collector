import { ZodError } from "zod";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitError,
  UnauthorizedError,
  UnsupportedMediaTypeError,
  ValidationError,
} from "@/lib/errors";
import { SubmissionValidationError } from "@/lib/submissions-dashboard/submission-errors";
import { FormClosedError } from "./fill.service";

const HEADERS = { "Cache-Control": "no-store" };

export function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: HEADERS });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { error: { code, message }, ...extra },
    { status, headers: { ...HEADERS, ...headers } },
  );
}

/** Traduce errores de dominio a HTTP. El 500 no revela detalles. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof UnauthorizedError) {
    return errorResponse(401, "UNAUTHORIZED", "Inicia sesión para continuar.");
  }
  if (error instanceof ForbiddenError) {
    return errorResponse(403, "FORBIDDEN", "No tienes acceso a este formulario.");
  }
  if (error instanceof NotFoundError) {
    return errorResponse(404, "NOT_FOUND", "No se ha encontrado el formulario.");
  }
  if (error instanceof FormClosedError) {
    return errorResponse(410, "FORM_CLOSED", "Este formulario ya no acepta respuestas");
  }
  if (error instanceof ConflictError) {
    return errorResponse(409, "CONFLICT", "Ese identificador ya se usó.");
  }
  if (error instanceof PayloadTooLargeError) {
    return errorResponse(413, "PAYLOAD_TOO_LARGE", "El archivo es demasiado grande (máximo 10 MB).");
  }
  if (error instanceof UnsupportedMediaTypeError) {
    return errorResponse(415, "UNSUPPORTED_MEDIA_TYPE", "Tipo de archivo no admitido.");
  }
  if (error instanceof RateLimitError) {
    const retryAfter = error.retryAfterSeconds ?? 60;
    return errorResponse(
      429,
      "RATE_LIMITED",
      "Demasiados intentos. Inténtalo de nuevo en unos minutos.",
      {},
      { "Retry-After": String(retryAfter) },
    );
  }
  if (error instanceof SubmissionValidationError) {
    return errorResponse(400, "VALIDATION", "Los datos no son válidos.", {
      fieldErrors: error.fieldErrors,
    });
  }
  if (error instanceof ValidationError || error instanceof ZodError) {
    return errorResponse(400, "VALIDATION", "Los datos no son válidos.");
  }
  return errorResponse(500, "INTERNAL", "Error interno.");
}

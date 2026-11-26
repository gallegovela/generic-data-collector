import { ZodError } from "zod";
import { getEnv } from "@/lib/env";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnauthorizedError,
  UnsupportedMediaTypeError,
  ValidationError,
} from "@/lib/errors";
import {
  fileKeyQuerySchema,
  uploadInputSchema,
} from "@/lib/file-storage/file-storage.schema";
import { requireSession } from "@/server/auth/session";
import { getSignedFileUrl, uploadFile } from "@/server/storage/storage.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MULTIPART_MARGIN_BYTES = 1024 * 1024;

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/** Traduce errores de dominio a HTTP. El 500 no revela detalles. */
function toErrorResponse(error: unknown): Response {
  if (error instanceof UnauthorizedError) {
    return errorResponse(401, "UNAUTHORIZED", "Inicia sesión para continuar.");
  }
  if (error instanceof ForbiddenError) {
    return errorResponse(403, "FORBIDDEN", "No tienes permiso para hacer esto.");
  }
  if (error instanceof NotFoundError) {
    return errorResponse(404, "NOT_FOUND", "No se ha encontrado el archivo.");
  }
  if (error instanceof ConflictError) {
    return errorResponse(
      409,
      "CONFLICT",
      "Ese identificador de subida ya se usó con otro tipo de archivo.",
    );
  }
  if (error instanceof PayloadTooLargeError) {
    return errorResponse(413, "PAYLOAD_TOO_LARGE", "El archivo es demasiado grande (máximo 10 MB).");
  }
  if (error instanceof UnsupportedMediaTypeError) {
    return errorResponse(415, "UNSUPPORTED_MEDIA_TYPE", "Tipo de archivo no admitido.");
  }
  if (error instanceof ValidationError || error instanceof ZodError) {
    return errorResponse(400, "VALIDATION", "Los datos de subida no son válidos.");
  }
  return errorResponse(500, "INTERNAL", "Error interno.");
}

/**
 * Subida autenticada de archivos (multipart: file, kind, uploadId).
 *
 * Cubre: RF-STO-06, RF-STO-10, CA-STO-04, CA-STO-05.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireSession();

    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > getEnv().STORAGE_MAX_UPLOAD_BYTES + MULTIPART_MARGIN_BYTES) {
      throw new PayloadTooLargeError();
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ValidationError("Cuerpo multipart no válido.");
    }

    const file = form.get("file");
    if (!(file instanceof File)) throw new ValidationError("Falta el archivo.");

    const input = uploadInputSchema.parse({
      kind: form.get("kind"),
      uploadId: form.get("uploadId"),
    });
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { file: stored, created } = await uploadFile(user.organizationId, {
      kind: input.kind,
      uploadId: input.uploadId,
      bytes,
    });
    return Response.json(stored, { status: created ? 201 : 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Lectura: redirección a una URL firmada de vida corta.
 *
 * Cubre: RF-STO-02, RF-STO-03, RF-STO-09, CA-STO-02, CA-STO-03.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireSession();
    const { key } = fileKeyQuerySchema.parse({
      key: new URL(request.url).searchParams.get("key") ?? "",
    });
    const { url } = await getSignedFileUrl(user.organizationId, key);

    return new Response(null, {
      status: 302,
      headers: { Location: url, "Cache-Control": "no-store" },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

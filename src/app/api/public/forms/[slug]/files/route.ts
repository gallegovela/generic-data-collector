import { getEnv } from "@/lib/env";
import { PayloadTooLargeError, ValidationError } from "@/lib/errors";
import { uploadInputSchema } from "@/lib/file-storage/file-storage.schema";
import { getCurrentUser } from "@/server/auth/session";
import { assertWithinFillLimit, clientIp } from "@/server/field-collector/fill-rate-limit";
import { uploadFillFile } from "@/server/field-collector/fill.service";
import { jsonResponse, toErrorResponse } from "@/server/field-collector/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MULTIPART_MARGIN_BYTES = 1024 * 1024;

/**
 * Subida de foto o firma al rellenar un formulario publicado (multipart:
 * file, kind, uploadId). Solo escritura: no hay lectura pública.
 *
 * Cubre: RF-COL-10, RF-COL-17, RF-COL-18, RF-COL-19
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  try {
    const { slug } = await params;
    const user = await getCurrentUser();
    if (!user) assertWithinFillLimit("upload", slug, clientIp(request.headers));

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
    if (input.kind === "document") throw new ValidationError("Tipo de archivo no válido.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { file: stored, created } = await uploadFillFile(slug, user, {
      kind: input.kind,
      uploadId: input.uploadId,
      bytes,
    });
    return jsonResponse(stored, created ? 201 : 200);
  } catch (error) {
    return toErrorResponse(error);
  }
}

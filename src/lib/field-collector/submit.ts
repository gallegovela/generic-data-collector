import type { FieldValidationError } from "@/lib/form-schema";

export type FillFiles = Record<
  string,
  Array<{ uploadId: string; kind: "photo" | "signature"; blob: Blob }>
>;
export type SubmitResult = { id: string; created: boolean };

/** Error de envío con un mensaje ya en español, apto para la interfaz. */
export class SubmitError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors: FieldValidationError[] = [],
  ) {
    super(message);
    this.name = "SubmitError";
  }
  /** Fallos de red y 5xx se pueden reintentar con el mismo clientId. */
  get retryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

const MESSAGES: Record<number, string> = {
  401: "Inicia sesión para continuar.",
  403: "No tienes acceso a este formulario.",
  404: "No se ha encontrado el formulario.",
  409: "Ese identificador ya se usó.",
  410: "Este formulario ya no acepta respuestas",
  413: "El archivo es demasiado grande (máximo 10 MB).",
  415: "Tipo de archivo no admitido.",
  429: "Demasiados intentos. Inténtalo de nuevo en unos minutos.",
};

export const NETWORK_ERROR_MESSAGE = "No se pudo enviar. Reintentar";

async function toError(response: Response): Promise<SubmitError> {
  let fieldErrors: FieldValidationError[] = [];
  if (response.status === 400) {
    try {
      const body = (await response.json()) as { fieldErrors?: FieldValidationError[] };
      fieldErrors = body.fieldErrors ?? [];
    } catch {
      /* sin detalle */
    }
    return new SubmitError("Los datos no son válidos.", 400, fieldErrors);
  }
  if (response.status >= 500) return new SubmitError(NETWORK_ERROR_MESSAGE, response.status);
  return new SubmitError(MESSAGES[response.status] ?? "Los datos no son válidos.", response.status);
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new SubmitError(NETWORK_ERROR_MESSAGE, 0);
  }
}

/** Sube un archivo (mismo `uploadId` al reintentar: idempotente). */
export async function uploadFile(
  slug: string,
  file: { uploadId: string; kind: "photo" | "signature"; blob: Blob },
): Promise<{ key: string; contentType: string; sizeBytes: number }> {
  const form = new FormData();
  form.set("file", file.blob, file.kind === "signature" ? "signature.png" : "photo");
  form.set("kind", file.kind);
  form.set("uploadId", file.uploadId);
  const response = await request(`/api/public/forms/${encodeURIComponent(slug)}/files`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw await toError(response);
  return (await response.json()) as { key: string; contentType: string; sizeBytes: number };
}

/**
 * Único punto de envío de una respuesta: aquí se pondrá la cola sin conexión.
 * Sube los archivos, coloca los `FileRef` en las respuestas y hace el POST.
 *
 * Cubre: RF-COL-08, RF-COL-18, RF-COL-20
 */
export async function submit(
  ctx: { slug: string; versionId: string; capturedAt: string; website?: string },
  clientId: string,
  answers: Record<string, unknown>,
  files: FillFiles,
): Promise<SubmitResult> {
  const finalAnswers: Record<string, unknown> = { ...answers };

  for (const [fieldId, list] of Object.entries(files)) {
    if (list.length === 0) continue;
    const refs = [];
    for (const item of list) {
      const uploaded = await uploadFile(ctx.slug, item);
      refs.push({ key: uploaded.key, mimeType: uploaded.contentType, sizeBytes: uploaded.sizeBytes });
    }
    finalAnswers[fieldId] = list[0].kind === "signature" ? refs[0] : refs;
  }

  const response = await request(`/api/public/forms/${encodeURIComponent(ctx.slug)}/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId,
      versionId: ctx.versionId,
      capturedAt: ctx.capturedAt,
      answers: finalAnswers,
      website: ctx.website ?? "",
    }),
  });
  if (!response.ok) throw await toError(response);
  return (await response.json()) as SubmitResult;
}

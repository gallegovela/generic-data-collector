import { ValidationError } from "@/lib/errors";
import { collectFileKeys } from "@/lib/field-collector/answers";
import type { FillSubmissionBody } from "@/lib/field-collector/fill.schema";
import type { CurrentUser } from "@/server/auth/session";
import {
  getFormForFilling,
  getFormVersion,
  type PublishedFormView,
} from "@/server/form-publishing/form-publishing.service";
import { createSubmission } from "@/server/submissions/submission.service";
import {
  attachFilesToSubmission,
  uploadFile,
  type UploadedFile,
} from "@/server/storage/storage.service";

/** El formulario existe pero ya no está publicado → 410. */
export class FormClosedError extends Error {
  constructor(message = "Este formulario ya no acepta respuestas") {
    super(message);
    this.name = "FormClosedError";
  }
}

async function resolvePublishedForm(
  slug: string,
  user: CurrentUser | null,
): Promise<PublishedFormView> {
  const lookup = await getFormForFilling(slug, user);
  if (lookup.state === "closed") throw new FormClosedError();
  return lookup.form;
}

/**
 * Sube una foto o firma. La organización es la del formulario, nunca la del
 * cliente.
 *
 * Cubre: RF-COL-10, RF-COL-17, RF-COL-18
 */
export async function uploadFillFile(
  slug: string,
  user: CurrentUser | null,
  input: { kind: "photo" | "signature"; uploadId: string; bytes: Uint8Array },
): Promise<{ file: UploadedFile; created: boolean }> {
  const form = await resolvePublishedForm(slug, user);
  if (input.kind !== "photo" && input.kind !== "signature") {
    throw new ValidationError("Tipo de archivo no válido.");
  }
  return uploadFile(form.organizationId, input);
}

/**
 * Guarda la respuesta de un formulario publicado, de forma idempotente por
 * `clientId`, y enlaza sus archivos.
 *
 * Cubre: RF-COL-08, RF-COL-13, RF-COL-17, RF-COL-18, RF-COL-19
 */
export async function submitFill(
  slug: string,
  user: CurrentUser | null,
  body: FillSubmissionBody,
): Promise<{ id: string; created: boolean }> {
  const form = await resolvePublishedForm(slug, user);

  // Honeypot: un bot rellena el campo oculto; no se guarda nada.
  if (body.website !== undefined && body.website.trim() !== "") {
    return { id: "", created: false };
  }

  const version = await getFormVersion(body.versionId);
  if (!version || version.formId !== form.formId || version.organizationId !== form.organizationId) {
    throw new ValidationError("La versión del formulario no es válida.");
  }

  const { submission, created } = await createSubmission({
    organizationId: form.organizationId,
    actor: user
      ? {
          kind: "user",
          userId: user.id,
          userName: user.name,
          userOrganizationId: user.organizationId,
        }
      : { kind: "anonymous" },
    form: {
      id: form.formId,
      title: form.name,
      versionId: version.id,
      versionNumber: version.version,
      schema: version.schema,
    },
    clientId: body.clientId,
    answers: body.answers,
    capturedAt: body.capturedAt,
  });

  await attachFilesToSubmission(
    form.organizationId,
    collectFileKeys(version.schema, submission.answers as Record<string, unknown>),
    submission.id,
  );

  // RNF-COL-05: nunca respuestas ni IP.
  console.log(JSON.stringify({ event: "fill.submitted", formId: form.formId, created }));

  return { id: submission.id, created };
}

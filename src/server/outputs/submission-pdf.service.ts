import type { Submission } from "@prisma/client";
import { getEnv } from "@/lib/env";
import { NotFoundError } from "@/lib/errors";
import { buildPdfFilename } from "@/lib/outputs/filename";
import { buildPdfModel, type PdfModel } from "@/lib/outputs/pdf-model";
import { findOrganizationById } from "@/server/auth/organization.repository";
import { findSubmissionById } from "@/server/submissions/submission.repository";
import { readFileBytes } from "@/server/storage/storage.service";
import { renderSubmissionPdf, type PdfImageEntry, type PdfImageMap } from "./pdf/submission-pdf";

/** Tope de lectura por imagen (también para el logo): evita cargar fotos enormes en memoria. */
export const MAX_IMAGE_READ_BYTES = 5 * 1024 * 1024;

const UNAVAILABLE = "[imagen no disponible]";
const UNSUPPORTED = "[imagen no incluida: formato no admitido en PDF]";

export type GeneratedPdf = { buffer: Buffer; imagesIncluded: boolean };

async function loadImage(organizationId: string, key: string): Promise<PdfImageEntry> {
  try {
    const file = await readFileBytes(organizationId, key);
    if (file.sizeBytes > MAX_IMAGE_READ_BYTES || file.bytes.byteLength > MAX_IMAGE_READ_BYTES) {
      return { placeholder: UNAVAILABLE };
    }
    if (file.contentType === "image/jpeg" || file.contentType === "image/png") {
      return { bytes: file.bytes, mime: file.contentType };
    }
    return { placeholder: UNSUPPORTED };
  } catch {
    return { placeholder: UNAVAILABLE };
  }
}

function collectKeys(model: PdfModel): string[] {
  const keys = new Set<string>();
  if (model.theme.logo) keys.add(model.theme.logo.key);
  for (const entry of model.entries) {
    if (entry.kind === "images") for (const image of entry.images) keys.add(image.key);
  }
  return [...keys];
}

/**
 * Genera el PDF de una respuesta. Si supera `maxBytes` lo regenera sin
 * imágenes y con un aviso; si aun así lo supera lanza Error("PDF_TOO_LARGE").
 * Nunca registra contenido de la respuesta.
 *
 * Cubre: RF-OUT-03, RF-OUT-17, CA-OUT-13
 */
export async function generateSubmissionPdf(
  submission: Submission,
  baseUrl: string,
  opts?: { maxBytes?: number },
): Promise<GeneratedPdf> {
  const maxBytes = opts?.maxBytes ?? getEnv().EMAIL_MAX_ATTACHMENT_BYTES;
  const organization = await findOrganizationById(submission.organizationId);
  const model = buildPdfModel({
    organizationName: organization?.name ?? "",
    submission,
    baseUrl,
  });

  const images: PdfImageMap = new Map();
  for (const key of collectKeys(model)) {
    images.set(key, await loadImage(submission.organizationId, key));
  }

  const withImages = await renderSubmissionPdf(model, images, { submissionId: submission.id });
  if (withImages.length <= maxBytes) return { buffer: withImages, imagesIncluded: true };

  const withoutImages = await renderSubmissionPdf(
    model,
    new Map([...images.keys()].map((key) => [key, { placeholder: "[imagen no incluida]" }])),
    {
      submissionId: submission.id,
      notice: `Este PDF no incluye las imágenes por su tamaño. Consúltalas en ${model.viewUrl}`,
    },
  );
  if (withoutImages.length > maxBytes) throw new Error("PDF_TOO_LARGE");
  return { buffer: withoutImages, imagesIncluded: false };
}

/**
 * Para la descarga. NotFoundError si la respuesta no existe en la
 * organización (mismo error si es de otra).
 *
 * Cubre: RF-OUT-04, CA-OUT-12
 */
export async function getSubmissionPdfForDownload(
  organizationId: string,
  formId: string,
  submissionId: string,
  baseUrl: string,
): Promise<{ filename: string; buffer: Buffer }> {
  const submission = await findSubmissionById(organizationId, submissionId);
  if (!submission || submission.formId !== formId) {
    throw new NotFoundError("No se ha encontrado la respuesta.");
  }
  const { buffer } = await generateSubmissionPdf(submission, baseUrl);
  return { filename: buildPdfFilename(submission.formTitle, submission.capturedAt, submission.id), buffer };
}

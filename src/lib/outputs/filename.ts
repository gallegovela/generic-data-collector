/** Minúsculas, [a-z0-9-]; "respuestas" si queda vacío. */
export function slugify(text: string): string {
  const s = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "respuestas";
}

/**
 * `${slugify(formTitle)}-${YYYYMMDD(capturedAt, UTC)}-${submissionId.slice(-8).toLowerCase()}.pdf`
 * (solo [a-z0-9-]: no permite inyectar cabeceras).
 *
 * Cubre: RF-OUT-04
 */
export function buildPdfFilename(formTitle: string, capturedAt: Date, submissionId: string): string {
  const day = capturedAt.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = submissionId.slice(-8).toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${slugify(formTitle)}-${day}-${suffix}.pdf`;
}

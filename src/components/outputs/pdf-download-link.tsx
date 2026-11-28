/** Enlace de descarga del PDF de una respuesta (solo admin). Cubre: RF-OUT-04 */
export function PdfDownloadLink({ formId, submissionId }: { formId: string; submissionId: string }) {
  return (
    <a
      href={`/api/forms/${formId}/submissions/${submissionId}/pdf`}
      className="inline-flex h-8 items-center rounded-lg border border-input px-2.5 text-sm hover:bg-muted"
      data-testid="pdf-download"
    >
      Descargar PDF
    </a>
  );
}

import type { SubmissionConsent } from "@/lib/submissions-dashboard/create-submission.schema";

/**
 * Prueba de aceptación de términos de una respuesta, solo lectura.
 *
 * Cubre: RF-SUB-13, CA-SUB-15
 */
export function SubmissionConsentBlock({ consent }: { consent: SubmissionConsent | null }) {
  if (!consent) return null;
  return (
    <div data-testid="submission-consent" className="rounded-md border p-3 text-sm">
      <p>
        Términos aceptados el {new Date(consent.acceptedAt).toLocaleString("es-ES")} (versión{" "}
        {consent.formVersionNumber} del formulario)
      </p>
      <p className="mt-1 flex gap-4">
        <a
          data-testid="terms-link"
          className="underline"
          href={consent.termsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Términos y condiciones
        </a>
        <a
          data-testid="privacy-link"
          className="underline"
          href={consent.privacyUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Política de privacidad
        </a>
      </p>
    </div>
  );
}

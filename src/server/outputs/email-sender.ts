import type { Destination, Submission } from "@prisma/client";
import { buildPdfFilename } from "@/lib/outputs/filename";
import { findOrganizationById } from "@/server/auth/organization.repository";
import { sendEmail } from "@/server/integrations/email";
import { generateSubmissionPdf } from "./submission-pdf.service";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Un mensaje a todos los destinatarios, con el PDF adjunto. El cuerpo no
 * lleva respuestas ni datos personales (solo van en el PDF).
 *
 * Cubre: RF-OUT-02, RNF-OUT-02
 */
export async function sendSubmissionEmail(
  destination: Destination,
  submission: Submission,
  baseUrl: string,
): Promise<{ ok: true } | { ok: false; error: "SMTP" | "PDF" }> {
  let pdf;
  try {
    pdf = await generateSubmissionPdf(submission, baseUrl);
  } catch {
    return { ok: false, error: "PDF" };
  }

  try {
    const organization = await findOrganizationById(submission.organizationId);
    const title = submission.formTitle.replace(/[\r\n]+/g, " ").slice(0, 130);
    const viewUrl = `${baseUrl.replace(/\/+$/, "")}/admin/forms/${submission.formId}/submissions/${submission.id}`;
    const version =
      submission.formVersionNumber === null ? "desconocida" : String(submission.formVersionNumber);
    const captured = submission.capturedAt.toISOString();
    const orgName = organization?.name ?? "";
    const text = [
      `Se ha recibido una nueva respuesta.`,
      `Organización: ${orgName}`,
      `Formulario: ${title}`,
      `Versión: ${version}`,
      `Fecha de captura: ${captured}`,
      `Ver la ficha: ${viewUrl}`,
      `El PDF adjunto contiene las respuestas.`,
    ].join("\n");
    const html = `<p>Se ha recibido una nueva respuesta.</p><ul><li>Organización: ${escapeHtml(orgName)}</li><li>Formulario: ${escapeHtml(title)}</li><li>Versión: ${escapeHtml(version)}</li><li>Fecha de captura: ${escapeHtml(captured)}</li></ul><p><a href="${escapeHtml(viewUrl)}">Ver la ficha</a></p><p>El PDF adjunto contiene las respuestas.</p>`;

    await sendEmail({
      to: destination.emailTo,
      subject: `Nueva respuesta: ${title}`.slice(0, 150),
      html,
      text,
      attachments: [
        {
          filename: buildPdfFilename(submission.formTitle, submission.capturedAt, submission.id),
          content: pdf.buffer,
          contentType: "application/pdf",
        },
      ],
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "SMTP" };
  }
}

import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";

export type SendEmailInput = { to: string; subject: string; html: string; text: string };

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | undefined;

function getTransporter() {
  if (!cachedTransporter) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = getEnv();

    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    });
  }

  return cachedTransporter;
}

/**
 * Envía un email por SMTP (nodemailer; Mailpit en local). No registra
 * en logs el destinatario ni el contenido del email, solo si el envío
 * tuvo éxito o falló (RGPD, ver CLAUDE.md).
 *
 * Cubre: RF-AUT-02, RF-AUT-04.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const { SMTP_FROM } = getEnv();

  try {
    await getTransporter().sendMail({
      from: SMTP_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    console.log("email enviado");
  } catch (error) {
    console.error("error al enviar el email", error instanceof Error ? error.message : error);
    throw error;
  }
}

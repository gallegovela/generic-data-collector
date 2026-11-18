/**
 * Constructores de los emails de tenancy-auth: asunto, HTML y texto
 * plano, sin E/S (fácil de testear). El envío real lo hace
 * `src/server/integrations/email.ts`.
 *
 * Cubre: RF-AUT-02, RF-AUT-04.
 */

export type EmailContent = { subject: string; html: string; text: string };

export function buildMagicLinkEmail(url: string): EmailContent {
  return {
    subject: "Tu enlace para iniciar sesión en FormIA",
    html: `
      <p>Hola,</p>
      <p>Pulsa el siguiente enlace para iniciar sesión en FormIA. El enlace caduca en 15 minutos y solo se puede usar una vez.</p>
      <p><a href="${url}">${url}</a></p>
      <p>Si no has pedido este enlace, puedes ignorar este mensaje.</p>
    `,
    text: `Hola,\n\nPulsa el siguiente enlace para iniciar sesión en FormIA (caduca en 15 minutos y solo se puede usar una vez):\n${url}\n\nSi no has pedido este enlace, puedes ignorar este mensaje.`,
  };
}

export function buildInvitationEmail(url: string, organizationName: string): EmailContent {
  return {
    subject: `Te han invitado a ${organizationName} en FormIA`,
    html: `
      <p>Hola,</p>
      <p>Te han invitado a unirte a <strong>${organizationName}</strong> en FormIA. Pulsa el siguiente enlace para crear tu contraseña y empezar:</p>
      <p><a href="${url}">${url}</a></p>
      <p>Este enlace caduca en 7 días.</p>
    `,
    text: `Hola,\n\nTe han invitado a unirte a ${organizationName} en FormIA. Pulsa el siguiente enlace para crear tu contraseña y empezar (caduca en 7 días):\n${url}`,
  };
}

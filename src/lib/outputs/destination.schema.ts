import { z } from "zod";
import { checkWebhookUrl } from "./webhook-url";

export const MAX_EMAIL_RECIPIENTS = 10;

export const saveEmailDestinationSchema = z.object({
  emails: z
    .array(z.string().trim().toLowerCase().email("Introduce un email válido.").max(254))
    .min(1, "Añade al menos un destinatario.")
    .max(MAX_EMAIL_RECIPIENTS, "Máximo 10 destinatarios.")
    .transform((list) => [...new Set(list)]),
  enabled: z.boolean().default(true),
});

const URL_MESSAGES = {
  invalid: "La URL no es válida.",
  protocol: "Solo se admiten URLs http o https.",
  credentials: "La URL no puede llevar usuario ni contraseña.",
  blocked_host: "La URL apunta a una dirección privada o no permitida.",
} as const;

export const saveWebhookDestinationSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2048, "La URL no es válida.")
    .superRefine((value, ctx) => {
      // En el cliente solo da el aviso temprano; la decisión real es la del servidor.
      const check = checkWebhookUrl(value, { allowLoopback: process.env.NODE_ENV !== "production" });
      if (!check.ok) ctx.addIssue({ code: "custom", message: URL_MESSAGES[check.reason] });
    }),
  enabled: z.boolean().default(true),
});

export type SaveEmailDestinationInput = z.input<typeof saveEmailDestinationSchema>;
export type SaveWebhookDestinationInput = z.input<typeof saveWebhookDestinationSchema>;
export type ParsedEmailDestination = z.output<typeof saveEmailDestinationSchema>;
export type ParsedWebhookDestination = z.output<typeof saveWebhookDestinationSchema>;

import { z } from "zod";

export const MAX_CONSENT_URL_LENGTH = 2048;

/**
 * Texto recortado; https obligatorio; sin usuario ni contraseña; hasta 2048
 * caracteres.
 *
 * Cubre: RF-PUB-12, CA-PUB-08
 */
export const HttpsUrlSchema = z
  .string()
  .trim()
  .max(MAX_CONSENT_URL_LENGTH, "El enlace es demasiado largo.")
  .superRefine((value, ctx) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Introduce un enlace válido." });
      return;
    }
    if (url.protocol !== "https:") {
      ctx.addIssue({ code: "custom", message: "El enlace debe empezar por https://." });
      return;
    }
    if (url.username !== "" || url.password !== "") {
      ctx.addIssue({ code: "custom", message: "Introduce un enlace válido." });
    }
  });

export const ConsentInputSchema = z.object({
  termsUrl: HttpsUrlSchema,
  privacyUrl: HttpsUrlSchema,
  publisherDeclaration: z.literal(true, {
    error: "Debes confirmar la declaración para publicar.",
  }),
});
export type ConsentInput = z.infer<typeof ConsentInputSchema>;

/** Lo que guarda FormVersion.consent. */
export const StoredConsentSchema = z.object({
  termsUrl: HttpsUrlSchema,
  privacyUrl: HttpsUrlSchema,
  declaredByUserId: z.string().min(1),
  declaredAt: z.string().datetime(),
});
export type StoredConsent = z.infer<typeof StoredConsentSchema>;

/** Lo que ve quien rellena (nunca declaredBy*). */
export type PublicConsent = { termsUrl: string; privacyUrl: string };

export function toPublicConsent(c: StoredConsent): PublicConsent {
  return { termsUrl: c.termsUrl, privacyUrl: c.privacyUrl };
}

/** Null si es null o no es válido; nunca lanza. */
export function parseStoredConsent(raw: unknown): StoredConsent | null {
  const parsed = StoredConsentSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

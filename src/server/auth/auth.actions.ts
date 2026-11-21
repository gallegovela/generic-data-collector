"use server";

import { requestMagicLinkSchema } from "@/lib/auth/auth.schema";
import { requestMagicLink } from "./auth.service";

/**
 * Pide un enlace mágico. Siempre devuelve `{ sent: true }`, exista o
 * no el email: no revela si un email está registrado (RNF-AUT-02).
 *
 * Cubre: RF-AUT-02, CA-AUT-05.
 */
export async function requestMagicLinkAction(
  _prevState: unknown,
  formData: FormData,
): Promise<{ sent: true }> {
  const parsed = requestMagicLinkSchema.safeParse({ email: formData.get("email") });

  if (parsed.success) {
    await requestMagicLink(parsed.data.email);
  }

  return { sent: true };
}

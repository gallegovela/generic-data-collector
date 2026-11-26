import type { FormAccessMode } from "@prisma/client";

export type AccessDecision = "allow" | "login-required" | "forbidden";

/**
 * `public` permite siempre. `registered`: sin usuario pide login; de otra
 * organización, prohibido; de la organización del formulario, permitido.
 *
 * Cubre: RF-PUB-09, CA-PUB-04
 */
export function decideAccess(
  accessMode: FormAccessMode,
  formOrganizationId: string,
  user: { organizationId: string } | null,
): AccessDecision {
  if (accessMode === "public") return "allow";
  if (!user) return "login-required";
  return user.organizationId === formOrganizationId ? "allow" : "forbidden";
}

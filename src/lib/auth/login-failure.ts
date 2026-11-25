import { InactiveUserError, RateLimitError, UnauthorizedError } from "@/lib/errors";

export type LoginProvider = "password" | "magic-link";
export type LoginFailureReason =
  | "invalid_credentials"
  | "inactive_user"
  | "rate_limited"
  | "internal_error"
  | "invalid_token";

/**
 * Traduce un error capturado en authorize() a un motivo tipado.
 * InactiveUserError hereda de UnauthorizedError: se comprueba antes.
 */
export function classifyLoginError(error: unknown, provider: LoginProvider): LoginFailureReason {
  if (error instanceof RateLimitError) {
    return "rate_limited";
  }

  if (error instanceof InactiveUserError) {
    return "inactive_user";
  }

  if (error instanceof UnauthorizedError) {
    return provider === "magic-link" ? "invalid_token" : "invalid_credentials";
  }

  return "internal_error";
}

/**
 * Una línea JSON por fallo. Nunca recibe ni registra email, contraseña,
 * token ni derivados; en `internal_error` solo la clase del error.
 *
 * Cubre: RNF-AUT-05, CA-AUT-10.
 */
export function logLoginFailure(
  provider: LoginProvider,
  reason: LoginFailureReason,
  error?: unknown,
): void {
  const entry: Record<string, string> = { event: "auth.login_failed", provider, reason };

  if (reason === "internal_error") {
    entry.errorClass = error instanceof Error ? error.constructor.name : typeof error;
  }

  console.warn(JSON.stringify(entry));
}

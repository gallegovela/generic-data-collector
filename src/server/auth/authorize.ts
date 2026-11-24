import { loginSchema } from "@/lib/auth/auth.schema";
import { RateLimitedSignin } from "@/lib/auth/login-errors";
import { classifyLoginError, logLoginFailure } from "@/lib/auth/login-failure";
import { verifyMagicLink, verifyPassword } from "./auth.service";
import type { CurrentUser } from "./session";

export type AuthUser = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: CurrentUser["role"];
};

type Credentials = Partial<Record<string, unknown>> | undefined;

function toAuthUser(user: CurrentUser): AuthUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

/**
 * Lógica de authorize() del proveedor "password". Registra el motivo de cada
 * fallo; solo `rate_limited` llega a la pantalla (RateLimitedSignin).
 *
 * Cubre: RF-AUT-01, RNF-AUT-05, CA-AUT-08..10.
 */
export async function authorizePassword(credentials: Credentials): Promise<AuthUser | null> {
  const parsed = loginSchema.safeParse(credentials);

  if (!parsed.success) {
    logLoginFailure("password", "invalid_credentials");
    return null;
  }

  try {
    return toAuthUser(await verifyPassword(parsed.data.email, parsed.data.password));
  } catch (error) {
    const reason = classifyLoginError(error, "password");
    logLoginFailure("password", reason, error);

    if (reason === "rate_limited") {
      throw new RateLimitedSignin();
    }

    return null;
  }
}

/** Lógica de authorize() del enlace mágico (sin límite de intentos). */
export async function authorizeMagicLink(credentials: Credentials): Promise<AuthUser | null> {
  const token = credentials?.token;

  if (typeof token !== "string" || token.length === 0) {
    logLoginFailure("magic-link", "invalid_token");
    return null;
  }

  try {
    return toAuthUser(await verifyMagicLink(token));
  } catch (error) {
    logLoginFailure("magic-link", classifyLoginError(error, "magic-link"), error);
    return null;
  }
}

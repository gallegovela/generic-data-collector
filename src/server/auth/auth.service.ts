import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";
import { buildMagicLinkEmail } from "@/lib/auth/emails";
import { InactiveUserError, RateLimitError, UnauthorizedError } from "@/lib/errors";
import { sendEmail } from "@/server/integrations/email";
import { createLoginToken, findValidLoginToken, markLoginTokenUsed } from "./login-token.repository";
import { isBlocked, recordFailure, reset } from "./rate-limit";
import type { CurrentUser } from "./session";
import { findUserByEmail } from "./user.repository";

export const LOGIN_RATE_LIMIT = { attempts: 5, windowMs: 15 * 60 * 1000 };
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

const PASSWORD_HASH_ROUNDS = 10;

function toCurrentUser(user: {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: CurrentUser["role"];
}): CurrentUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

/** Cubre: RNF-AUT-01. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Hash bcrypt fijo (10 rondas) para igualar el tiempo de respuesta cuando el
// email no existe (RNF-AUT-02). No corresponde a ninguna contraseña real.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.4oBxsoBwQYQAbBRHXc0vJeTgY0aO";

/**
 * Verifica email + contraseña contra `User`. Solo cuentan los fallos
 * (RNF-AUT-04): primero consulta el bloqueo sin consumir cupo; un fallo
 * (también email inexistente) se registra; un acierto reinicia el
 * contador. Lanza RateLimitError, InactiveUserError (inactivo con
 * contraseña correcta) o UnauthorizedError. Los errores de base de datos
 * se propagan sin registrar fallo.
 *
 * Cubre: RF-AUT-01, CA-AUT-04, CA-AUT-06..09, RNF-AUT-01, RNF-AUT-04.
 */
export async function verifyPassword(email: string, password: string): Promise<CurrentUser> {
  const key = normalizeEmail(email);

  if (isBlocked(key, LOGIN_RATE_LIMIT.attempts, LOGIN_RATE_LIMIT.windowMs)) {
    throw new RateLimitError();
  }

  const user = await findUserByEmail(key);
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordMatches) {
    recordFailure(key, LOGIN_RATE_LIMIT.windowMs);
    throw new UnauthorizedError("Email o contraseña incorrectos.");
  }

  if (user.status !== "active") {
    recordFailure(key, LOGIN_RATE_LIMIT.windowMs);
    throw new InactiveUserError();
  }

  reset(key);
  return toCurrentUser(user);
}

/**
 * Si existe un `User` activo con ese email, crea un `LoginToken` (TTL
 * MAGIC_LINK_TTL_MS) y envía el email con el enlace
 * `${AUTH_URL}/login/magic?token=...`. Si no existe o está `inactive`,
 * no hace nada. Nunca lanza por "no encontrado": el resultado para
 * quien llama es siempre el mismo (RNF-AUT-02).
 *
 * Cubre: RF-AUT-02, CA-AUT-05.
 */
export async function requestMagicLink(email: string): Promise<void> {
  const user = await findUserByEmail(normalizeEmail(email));

  if (!user || user.status !== "active") {
    return;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  await createLoginToken(user.id, token, expiresAt);

  const { AUTH_URL } = getEnv();
  const url = `${AUTH_URL}/login/magic?token=${token}`;
  const content = buildMagicLinkEmail(url);

  await sendEmail({ to: user.email, ...content });
}

/**
 * Busca un LoginToken válido (no caducado, no usado), lo marca usado y
 * devuelve CurrentUser. Lanza UnauthorizedError si no es válido.
 *
 * Cubre: RF-AUT-02, CA-AUT-05.
 */
export async function verifyMagicLink(token: string): Promise<CurrentUser> {
  const loginToken = await findValidLoginToken(token);

  if (!loginToken || loginToken.user.status !== "active") {
    throw new UnauthorizedError("El enlace no es válido o ha caducado.");
  }

  await markLoginTokenUsed(loginToken.id);

  return toCurrentUser(loginToken.user);
}

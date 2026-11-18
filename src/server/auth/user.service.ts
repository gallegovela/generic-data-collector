import { randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";
import { buildInvitationEmail } from "@/lib/auth/emails";
import type { InviteUserInput } from "@/lib/auth/auth.schema";
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { sendEmail } from "@/server/integrations/email";
import { hashPassword } from "./auth.service";
import {
  createInvitation,
  findInvitationByToken,
  markInvitationAccepted,
} from "./invitation.repository";
import { findOrganizationById } from "./organization.repository";
import type { CurrentUser } from "./session";
import { createUser, findUserByEmail, listUsersByOrganization, updateUserStatus } from "./user.repository";
import type { User } from "@prisma/client";

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function toCurrentUser(user: User): CurrentUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

/**
 * Crea la invitación y envía el email con el enlace
 * `${AUTH_URL}/invite/<token>`. Lanza ConflictError si ya existe un
 * `User` (de cualquier organización) con ese email.
 *
 * Cubre: RF-AUT-03, RF-AUT-04, CA-AUT-03.
 */
export async function inviteUser(
  organizationId: string,
  invitedByUserId: string,
  input: InviteUserInput,
) {
  const existing = await findUserByEmail(input.email);

  if (existing) {
    throw new ConflictError("Ya hay un usuario con ese email.");
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const invitation = await createInvitation(organizationId, {
    email: input.email,
    role: input.role,
    invitedByUserId,
    token,
    expiresAt,
  });

  const organization = await findOrganizationById(organizationId);
  const { AUTH_URL } = getEnv();
  const url = `${AUTH_URL}/invite/${token}`;
  const content = buildInvitationEmail(url, organization?.name ?? "FormIA");

  await sendEmail({ to: input.email, ...content });

  return invitation;
}

/**
 * Busca la invitación por token; lanza UnauthorizedError si no existe,
 * está caducada o ya se aceptó. Crea el `User` con el rol de la
 * invitación y la contraseña dada, marca la invitación aceptada y
 * devuelve CurrentUser (CA-AUT-03).
 */
export async function acceptInvitation(token: string, password: string): Promise<CurrentUser> {
  const invitation = await findInvitationByToken(token);

  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    throw new UnauthorizedError("La invitación no es válida o ha caducado.");
  }

  const passwordHash = await hashPassword(password);
  // El formulario de invitación solo pide la contraseña
  // (acceptInvitationSchema): no hay un nombre que capturar en la
  // invitación, así que se usa la parte local del email como nombre
  // inicial; el propio usuario podrá cambiarlo más adelante si algún
  // módulo posterior añade esa opción.
  const name = invitation.email.split("@")[0] ?? invitation.email;
  const user = await createUser(invitation.organizationId, {
    email: invitation.email,
    name,
    role: invitation.role,
    passwordHash,
  });

  await markInvitationAccepted(invitation.id);

  return toCurrentUser(user);
}

export async function listUsers(
  organizationId: string,
): Promise<Array<Pick<User, "id" | "email" | "name" | "role" | "status">>> {
  const users = await listUsersByOrganization(organizationId);

  return users.map(({ id, email, name, role, status }) => ({ id, email, name, role, status }));
}

/**
 * Lanza ForbiddenError si `userId === actingUserId` (nadie se
 * desactiva a sí mismo). Lanza NotFoundError si `userId` no pertenece
 * a `organizationId` (CA-AUT-01).
 *
 * Cubre: RF-AUT-05, CA-AUT-01.
 */
export async function deactivateUser(
  organizationId: string,
  actingUserId: string,
  userId: string,
): Promise<void> {
  if (userId === actingUserId) {
    throw new ForbiddenError("No puedes desactivarte a ti mismo.");
  }

  const result = await updateUserStatus(organizationId, userId, "inactive");

  if (!result) {
    throw new NotFoundError();
  }
}

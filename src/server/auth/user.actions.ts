"use server";

import { acceptInvitationSchema, inviteUserSchema } from "@/lib/auth/auth.schema";
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { acceptInvitation, deactivateUser, inviteUser } from "./user.service";
import { requireSession } from "./session";

/**
 * Invita a un usuario. Requiere sesión de `admin`.
 *
 * Cubre: RF-AUT-04, CA-AUT-03.
 */
export async function inviteUserAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; invited?: true }> {
  const currentUser = await requireSession({ role: "admin" });

  const parsed = inviteUserSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await inviteUser(currentUser.organizationId, currentUser.id, parsed.data);
    return { invited: true };
  } catch (error) {
    if (error instanceof ConflictError) {
      return { error: "Ya hay un usuario con ese email." };
    }
    throw error;
  }
}

/**
 * Desactiva un usuario de la organización del admin actual. Requiere
 * sesión de `admin`.
 *
 * Cubre: RF-AUT-05, CA-AUT-01.
 */
export async function deactivateUserAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const currentUser = await requireSession({ role: "admin" });
  const userId = formData.get("userId");

  if (typeof userId !== "string" || userId.length === 0) {
    return { error: "Falta el usuario a desactivar." };
  }

  try {
    await deactivateUser(currentUser.organizationId, currentUser.id, userId);
    return {};
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { error: "No puedes desactivarte a ti mismo." };
    }
    if (error instanceof NotFoundError) {
      return { error: "No se ha encontrado." };
    }
    throw error;
  }
}

/**
 * Acepta una invitación fijando la contraseña. No requiere sesión
 * (el usuario todavía no existe). Devuelve el email del usuario creado
 * para que la página, en cliente, pueda llamar a
 * `signIn("password", { email, password })` y abrir sesión (ver
 * design.md#server-actions; el campo `email` se añade al contrato
 * documentado porque la página lo necesita para iniciar sesión tras
 * aceptar la invitación).
 *
 * Cubre: RF-AUT-03, CA-AUT-03.
 */
export async function acceptInvitationAction(
  token: string,
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; email?: string }> {
  const parsed = acceptInvitationSchema.safeParse({ password: formData.get("password") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const current = await acceptInvitation(token, parsed.data.password);
    return { email: current.email };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { error: "La invitación no es válida o ha caducado." };
    }
    throw error;
  }
}

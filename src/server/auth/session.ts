import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

export type CurrentUser = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: Role;
};

/** Lee la sesión de Auth.js (`auth()` en `src/auth.ts`). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || !user.organizationId || !user.email || !user.role) {
    return null;
  }

  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name ?? user.email,
    role: user.role,
  };
}

/**
 * Para route handlers y server actions: lanza UnauthorizedError (401)
 * si no hay sesión, ForbiddenError (403) si `options.role` no
 * coincide.
 *
 * Cubre: RF-AUT-06, RF-AUT-07.
 */
export async function requireSession(options?: { role?: Role }): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  if (options?.role && user.role !== options.role) {
    throw new ForbiddenError();
  }

  return user;
}

/**
 * Para Server Components (páginas/layouts): igual que requireSession
 * pero en vez de lanzar, hace redirect("/login") o redirect("/collect")
 * (admin requerido y el usuario es collector).
 *
 * Cubre: RF-AUT-06, CA-AUT-02.
 */
export async function requireAdminPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    redirect("/collect");
  }

  return user;
}

/**
 * Azúcar sobre requireSession: `(await requireSession(options)).organizationId`.
 * Es la función que reutilizan los repositorios de los demás módulos.
 */
export async function getCurrentOrg(options?: { role?: Role }): Promise<string> {
  return (await requireSession(options)).organizationId;
}

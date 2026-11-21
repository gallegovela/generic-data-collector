import type { Role, User, UserStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";

/**
 * Repositorio de `User`. Todas las funciones reciben `organizationId`
 * y lo usan en el `where`, salvo `findUserByEmail`: es anterior a
 * conocer la sesión (la usa el login, antes de saber a qué
 * organización pertenece el usuario). Ver RNF-AUT-02.
 */

export function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export function findUserById(organizationId: string, id: string): Promise<User | null> {
  return prisma.user.findFirst({ where: { id, organizationId } });
}

export function listUsersByOrganization(organizationId: string): Promise<User[]> {
  return prisma.user.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } });
}

export function createUser(
  organizationId: string,
  data: { email: string; name: string; role: Role; passwordHash: string },
): Promise<User> {
  return prisma.user.create({
    data: {
      organizationId,
      email: data.email,
      name: data.name,
      role: data.role,
      passwordHash: data.passwordHash,
    },
  });
}

/**
 * Actualiza el estado de un `User` que pertenezca a `organizationId`.
 * Devuelve `null` si no existe un usuario con ese `id` **en esa
 * organización** (CA-AUT-01): un `id` de otra organización se trata
 * igual que uno inexistente, nunca revela que existe.
 */
export async function updateUserStatus(
  organizationId: string,
  id: string,
  status: UserStatus,
): Promise<User | null> {
  const existing = await prisma.user.findFirst({ where: { id, organizationId } });

  if (!existing) {
    return null;
  }

  return prisma.user.update({ where: { id }, data: { status } });
}

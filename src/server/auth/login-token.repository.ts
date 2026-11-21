import type { LoginToken, User } from "@prisma/client";
import { prisma } from "@/server/db/client";

export function createLoginToken(
  userId: string,
  token: string,
  expiresAt: Date,
): Promise<LoginToken> {
  return prisma.loginToken.create({ data: { userId, token, expiresAt } });
}

/** Busca un LoginToken no caducado y no usado, con su `User`. */
export function findValidLoginToken(
  token: string,
): Promise<(LoginToken & { user: User }) | null> {
  return prisma.loginToken.findFirst({
    where: { token, usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
}

export function markLoginTokenUsed(id: string): Promise<LoginToken> {
  return prisma.loginToken.update({ where: { id }, data: { usedAt: new Date() } });
}

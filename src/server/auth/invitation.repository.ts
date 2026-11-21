import type { Invitation, Role } from "@prisma/client";
import { prisma } from "@/server/db/client";

export function createInvitation(
  organizationId: string,
  data: { email: string; role: Role; invitedByUserId: string; token: string; expiresAt: Date },
): Promise<Invitation> {
  return prisma.invitation.create({
    data: {
      organizationId,
      email: data.email,
      role: data.role,
      invitedByUserId: data.invitedByUserId,
      token: data.token,
      expiresAt: data.expiresAt,
    },
  });
}

export function findInvitationByToken(token: string): Promise<Invitation | null> {
  return prisma.invitation.findUnique({ where: { token } });
}

export function markInvitationAccepted(id: string): Promise<Invitation> {
  return prisma.invitation.update({ where: { id }, data: { acceptedAt: new Date() } });
}

export function listPendingInvitations(organizationId: string): Promise<Invitation[]> {
  return prisma.invitation.findMany({
    where: { organizationId, acceptedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

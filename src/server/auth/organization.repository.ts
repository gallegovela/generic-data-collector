import type { Organization } from "@prisma/client";
import { prisma } from "@/server/db/client";

export function createOrganization(data: { name: string }): Promise<Organization> {
  return prisma.organization.create({ data });
}

export function findOrganizationById(id: string): Promise<Organization | null> {
  return prisma.organization.findUnique({ where: { id } });
}

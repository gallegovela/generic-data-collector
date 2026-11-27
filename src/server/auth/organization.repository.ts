import type { Organization } from "@prisma/client";
import { DEFAULT_PLAN_ID } from "@/lib/admin-settings/plan.schema";
import { prisma } from "@/server/db/client";

export function createOrganization(data: { name: string; planId?: string }): Promise<Organization> {
  return prisma.organization.create({ data: { name: data.name, planId: data.planId ?? DEFAULT_PLAN_ID } });
}

export function findOrganizationById(id: string): Promise<Organization | null> {
  return prisma.organization.findUnique({ where: { id } });
}

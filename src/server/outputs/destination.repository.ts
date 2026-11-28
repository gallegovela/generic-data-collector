import type { Destination, DestinationKind } from "@prisma/client";
import { prisma } from "@/server/db/client";

// Todas las consultas llevan organizationId (CA-OUT-09).

export function listDestinationsByForm(organizationId: string, formId: string): Promise<Destination[]> {
  return prisma.destination.findMany({ where: { organizationId, formId }, orderBy: { kind: "asc" } });
}

export function listEnabledDestinationsByForm(
  organizationId: string,
  formId: string,
): Promise<Destination[]> {
  return prisma.destination.findMany({ where: { organizationId, formId, enabled: true } });
}

export function findDestination(
  organizationId: string,
  formId: string,
  kind: DestinationKind,
): Promise<Destination | null> {
  return prisma.destination.findFirst({ where: { organizationId, formId, kind } });
}

export function findDestinationById(organizationId: string, id: string): Promise<Destination | null> {
  return prisma.destination.findFirst({ where: { organizationId, id } });
}

/** En update NO toca `webhookSecret` salvo que venga. */
export async function upsertDestination(
  organizationId: string,
  formId: string,
  kind: DestinationKind,
  data: { enabled: boolean; emailTo?: string[]; webhookUrl?: string; webhookSecret?: string },
): Promise<Destination> {
  const existing = await findDestination(organizationId, formId, kind);
  if (existing) {
    return prisma.destination.update({
      where: { id: existing.id },
      data: {
        enabled: data.enabled,
        ...(data.emailTo !== undefined ? { emailTo: data.emailTo } : {}),
        ...(data.webhookUrl !== undefined ? { webhookUrl: data.webhookUrl } : {}),
        ...(data.webhookSecret !== undefined ? { webhookSecret: data.webhookSecret } : {}),
      },
    });
  }
  return prisma.destination.create({
    data: {
      organizationId,
      formId,
      kind,
      enabled: data.enabled,
      emailTo: data.emailTo ?? [],
      webhookUrl: data.webhookUrl ?? null,
      webhookSecret: data.webhookSecret ?? null,
    },
  });
}

export async function updateWebhookSecret(
  organizationId: string,
  formId: string,
  secret: string,
): Promise<boolean> {
  const result = await prisma.destination.updateMany({
    where: { organizationId, formId, kind: "webhook" },
    data: { webhookSecret: secret },
  });
  return result.count > 0;
}

/** Borra el destino y, en la misma transacción, sus envíos e intentos. */
export async function deleteDestinationWithDeliveries(
  organizationId: string,
  formId: string,
  kind: DestinationKind,
): Promise<boolean> {
  const destination = await findDestination(organizationId, formId, kind);
  if (!destination) return false;
  const deliveries = await prisma.delivery.findMany({
    where: { organizationId, destinationId: destination.id },
    select: { id: true },
  });
  const ids = deliveries.map((d) => d.id);
  await prisma.$transaction([
    prisma.deliveryAttempt.deleteMany({ where: { organizationId, deliveryId: { in: ids } } }),
    prisma.delivery.deleteMany({ where: { organizationId, destinationId: destination.id } }),
    prisma.destination.deleteMany({ where: { organizationId, id: destination.id } }),
  ]);
  return true;
}

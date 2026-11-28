import type { Delivery, DeliveryAttempt, DeliveryStatus, DestinationKind } from "@prisma/client";
import { STUCK_SENDING_SECONDS } from "@/lib/outputs/delivery-policy";
import { prisma } from "@/server/db/client";

export type NewDelivery = {
  organizationId: string;
  destinationId: string;
  formId: string;
  submissionId: string;
  kind: DestinationKind;
  nextAttemptAt: Date;
};

/** Un envío por (destino, respuesta): la restricción única de BD evita duplicados (CA-OUT-08). */
export async function createDeliveries(rows: NewDelivery[]): Promise<void> {
  if (rows.length === 0) return;
  await prisma.delivery.createMany({ data: rows, skipDuplicates: true });
}

export function listDeliveryIdsFor(
  organizationId: string,
  submissionId: string,
): Promise<{ id: string }[]> {
  return prisma.delivery.findMany({
    where: { organizationId, submissionId },
    select: { id: true },
  });
}

export function findDeliveryById(id: string): Promise<Delivery | null> {
  return prisma.delivery.findUnique({ where: { id } });
}

export function findDeliveryForOrganization(
  organizationId: string,
  formId: string,
  id: string,
): Promise<Delivery | null> {
  return prisma.delivery.findFirst({ where: { id, organizationId, formId } });
}

/**
 * Reclamo atómico: pending vencido, o sending atascado (updatedAt antiguo).
 * Devuelve false si otro proceso lo reclamó antes o aún no toca.
 */
export async function claimDelivery(id: string, now: Date): Promise<boolean> {
  const stuckBefore = new Date(now.getTime() - STUCK_SENDING_SECONDS * 1000);
  const result = await prisma.delivery.updateMany({
    where: {
      id,
      OR: [
        { status: "pending", nextAttemptAt: { lte: now } },
        { status: "sending", updatedAt: { lt: stuckBefore } },
      ],
    },
    data: { status: "sending" },
  });
  return result.count === 1;
}

export async function findDueDeliveries(now: Date, limit: number): Promise<Delivery[]> {
  const stuckBefore = new Date(now.getTime() - STUCK_SENDING_SECONDS * 1000);
  return prisma.delivery.findMany({
    where: {
      OR: [
        { status: "pending", nextAttemptAt: { lte: now } },
        { status: "sending", updatedAt: { lt: stuckBefore } },
      ],
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });
}

export async function countAttempts(deliveryId: string): Promise<number> {
  return prisma.deliveryAttempt.count({ where: { deliveryId } });
}

export type AttemptRecord = {
  deliveryId: string;
  organizationId: string;
  startedAt: Date;
  durationMs: number;
  ok: boolean;
  statusCode: number | null;
  error: string | null;
};

/** `number` = nº de intentos previos del envío + 1 (correlativo, no se reinicia al reenviar). */
export async function insertAttempt(record: AttemptRecord): Promise<void> {
  const number = (await countAttempts(record.deliveryId)) + 1;
  await prisma.deliveryAttempt.create({ data: { ...record, number } });
}

export function updateDeliveryOutcome(
  id: string,
  data: {
    status: DeliveryStatus;
    attempts: number;
    nextAttemptAt?: Date;
    lastError: string | null;
    lastStatusCode: number | null;
    sentAt?: Date | null;
  },
): Promise<Delivery> {
  return prisma.delivery.update({ where: { id }, data });
}

/** Reenvío manual: solo desde `failed`. Devuelve false si ya no lo estaba. */
export async function resetFailedDelivery(
  organizationId: string,
  id: string,
  now: Date,
): Promise<boolean> {
  const result = await prisma.delivery.updateMany({
    where: { id, organizationId, status: "failed" },
    data: { status: "pending", attempts: 0, nextAttemptAt: now, lastError: null, lastStatusCode: null },
  });
  return result.count === 1;
}

export function listRecentDeliveries(organizationId: string, formId: string, take: number): Promise<Delivery[]> {
  return prisma.delivery.findMany({
    where: { organizationId, formId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function listRecentAttempts(
  organizationId: string,
  deliveryIds: string[],
): Promise<DeliveryAttempt[]> {
  return prisma.deliveryAttempt.findMany({
    where: { organizationId, deliveryId: { in: deliveryIds } },
    orderBy: { number: "desc" },
  });
}

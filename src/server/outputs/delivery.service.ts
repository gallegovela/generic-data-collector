import type { Delivery, Submission } from "@prisma/client";
import { getEnv } from "@/lib/env";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { nextAttemptDelaySeconds } from "@/lib/outputs/delivery-policy";
import { buildWebhookPayload } from "@/lib/outputs/webhook-payload";
import { findFormById } from "@/server/forms/form.repository";
import { findSubmissionById } from "@/server/submissions/submission.repository";
import { findDestinationById } from "./destination.repository";
import { listEnabledDestinationsByForm } from "./destination.repository";
import {
  claimDelivery,
  createDeliveries,
  findDeliveryById,
  findDeliveryForOrganization,
  findDueDeliveries,
  insertAttempt,
  listDeliveryIdsFor,
  listRecentAttempts,
  listRecentDeliveries,
  resetFailedDelivery,
  updateDeliveryOutcome,
} from "./delivery.repository";
import { sendSubmissionEmail } from "./email-sender";
import { postWebhook } from "./webhook-sender";

export type DeliveryAttemptView = {
  number: number;
  startedAt: Date;
  durationMs: number;
  ok: boolean;
  statusCode: number | null;
  error: string | null;
};

export type DeliveryView = {
  id: string;
  kind: "email" | "webhook";
  submissionId: string;
  status: "pending" | "sending" | "sent" | "failed";
  attempts: number;
  nextAttemptAt: Date | null;
  lastError: string | null;
  lastStatusCode: number | null;
  sentAt: Date | null;
  createdAt: Date;
  attemptLog: DeliveryAttemptView[];
};

export type ProcessOutcome = "sent" | "retry" | "failed" | "skipped";

/** Log sin contenido: solo identificadores y códigos (RNF-OUT-05). */
function logSafe(event: string, fields: Record<string, string | number | null>): void {
  console.log(JSON.stringify({ event, ...fields }));
}

/**
 * NUNCA lanza. Crea un Delivery por destino habilitado (idempotente por
 * (destino, respuesta)) y lanza el envío sin esperarlo.
 *
 * Cubre: RF-OUT-13, RF-OUT-14, RNF-OUT-01
 */
export async function scheduleDeliveries(organizationId: string, submission: Submission): Promise<void> {
  try {
    const destinations = await listEnabledDestinationsByForm(organizationId, submission.formId);
    if (destinations.length === 0) return;
    const now = new Date();
    await createDeliveries(
      destinations.map((d) => ({
        organizationId,
        destinationId: d.id,
        formId: submission.formId,
        submissionId: submission.id,
        kind: d.kind,
        nextAttemptAt: now,
      })),
    );
    const created = await listDeliveryIdsFor(organizationId, submission.id);
    for (const { id } of created) {
      void processDelivery(id).catch(() => logSafe("delivery.process_error", { deliveryId: id }));
    }
  } catch {
    logSafe("delivery.schedule_error", { submissionId: submission.id });
  }
}

type AttemptResult = { ok: true; statusCode: number | null } | { ok: false; statusCode: number | null; error: string };

async function attemptSend(delivery: Delivery, now: Date): Promise<AttemptResult> {
  const destination = await findDestinationById(delivery.organizationId, delivery.destinationId);
  if (!destination) return { ok: false, statusCode: null, error: "DESTINATION_GONE" };
  if (!destination.enabled) return { ok: false, statusCode: null, error: "DESTINATION_DISABLED" };
  const submission = await findSubmissionById(delivery.organizationId, delivery.submissionId);
  if (!submission) return { ok: false, statusCode: null, error: "SUBMISSION_GONE" };

  const baseUrl = getEnv().AUTH_URL.replace(/\/+$/, "");
  if (delivery.kind === "email") {
    const result = await sendSubmissionEmail(destination, submission, baseUrl);
    return result.ok ? { ok: true, statusCode: null } : { ok: false, statusCode: null, error: result.error };
  }
  if (!destination.webhookUrl || !destination.webhookSecret) {
    return { ok: false, statusCode: null, error: "DESTINATION_GONE" };
  }
  const result = await postWebhook({
    url: destination.webhookUrl,
    secret: destination.webhookSecret,
    body: JSON.stringify(buildWebhookPayload(submission, delivery.id)),
    deliveryId: delivery.id,
    now,
  });
  return result.ok
    ? { ok: true, statusCode: result.statusCode }
    : { ok: false, statusCode: result.statusCode ?? null, error: result.error };
}

const FATAL = new Set(["SUBMISSION_GONE", "DESTINATION_GONE", "DESTINATION_DISABLED"]);

/**
 * Reclama, envía y registra el intento. Las excepciones inesperadas cuentan
 * como fallo.
 *
 * Cubre: RF-OUT-09, CA-OUT-03
 */
export async function processDelivery(deliveryId: string, now: Date = new Date()): Promise<ProcessOutcome> {
  if (!(await claimDelivery(deliveryId, now))) return "skipped";
  const delivery = await findDeliveryById(deliveryId);
  if (!delivery) return "skipped";

  const startedAt = new Date();
  let result: AttemptResult;
  try {
    result = await attemptSend(delivery, now);
  } catch {
    result = { ok: false, statusCode: null, error: delivery.kind === "email" ? "SMTP" : "NETWORK" };
  }
  const durationMs = Date.now() - startedAt.getTime();

  await insertAttempt({
    deliveryId,
    organizationId: delivery.organizationId,
    startedAt,
    durationMs,
    ok: result.ok,
    statusCode: result.statusCode,
    error: result.ok ? null : result.error,
  });

  const attempts = delivery.attempts + 1;
  if (result.ok) {
    await updateDeliveryOutcome(deliveryId, {
      status: "sent",
      attempts,
      lastError: null,
      lastStatusCode: result.statusCode,
      sentAt: new Date(),
    });
    logSafe("delivery.sent", { deliveryId, kind: delivery.kind, statusCode: result.statusCode });
    return "sent";
  }

  const delay = FATAL.has(result.error) ? null : nextAttemptDelaySeconds(attempts);
  if (delay === null) {
    await updateDeliveryOutcome(deliveryId, {
      status: "failed",
      attempts,
      lastError: result.error,
      lastStatusCode: result.statusCode,
    });
    logSafe("delivery.failed", { deliveryId, kind: delivery.kind, error: result.error, statusCode: result.statusCode });
    return "failed";
  }
  await updateDeliveryOutcome(deliveryId, {
    status: "pending",
    attempts,
    nextAttemptAt: new Date(now.getTime() + delay * 1000),
    lastError: result.error,
    lastStatusCode: result.statusCode,
  });
  logSafe("delivery.retry", { deliveryId, kind: delivery.kind, error: result.error, statusCode: result.statusCode });
  return "retry";
}

/**
 * Procesador del sistema: único punto sin filtro de organización (cada
 * envío se procesa con SU organizationId y no devuelve datos a nadie).
 *
 * Cubre: RNF-OUT-06
 */
export async function processDueDeliveries(now: Date = new Date(), limit = 20): Promise<number> {
  const due = await findDueDeliveries(now, limit);
  let processed = 0;
  for (const delivery of due) {
    const outcome = await processDelivery(delivery.id, now);
    if (outcome !== "skipped") processed += 1;
  }
  return processed;
}

/** Cubre: RF-OUT-10, CA-OUT-11, CA-OUT-09 */
export async function retryDelivery(organizationId: string, formId: string, deliveryId: string): Promise<void> {
  const delivery = await findDeliveryForOrganization(organizationId, formId, deliveryId);
  if (!delivery) throw new NotFoundError("No se ha encontrado el envío.");
  if (delivery.status !== "failed") {
    throw new ConflictError("Solo se pueden reenviar los envíos fallidos.");
  }
  const now = new Date();
  if (!(await resetFailedDelivery(organizationId, deliveryId, now))) {
    throw new ConflictError("Solo se pueden reenviar los envíos fallidos.");
  }
  void processDelivery(deliveryId, now).catch(() => logSafe("delivery.process_error", { deliveryId }));
}

/** Los 50 últimos del formulario con sus intentos (últimos 10 por envío). */
export async function listDeliveries(organizationId: string, formId: string): Promise<DeliveryView[]> {
  const form = await findFormById(organizationId, formId);
  if (!form) throw new NotFoundError("No se ha encontrado el formulario.");
  const deliveries = await listRecentDeliveries(organizationId, formId, 50);
  const attempts = await listRecentAttempts(
    organizationId,
    deliveries.map((d) => d.id),
  );
  return deliveries.map((d) => ({
    id: d.id,
    kind: d.kind,
    submissionId: d.submissionId,
    status: d.status,
    attempts: d.attempts,
    nextAttemptAt: d.status === "pending" ? d.nextAttemptAt : null,
    lastError: d.lastError,
    lastStatusCode: d.lastStatusCode,
    sentAt: d.sentAt,
    createdAt: d.createdAt,
    attemptLog: attempts
      .filter((a) => a.deliveryId === d.id)
      .slice(0, 10)
      .map((a) => ({
        number: a.number,
        startedAt: a.startedAt,
        durationMs: a.durationMs,
        ok: a.ok,
        statusCode: a.statusCode,
        error: a.error,
      })),
  }));
}

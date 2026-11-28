import { randomBytes } from "node:crypto";
import type { Destination, DestinationKind } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import {
  saveEmailDestinationSchema,
  saveWebhookDestinationSchema,
  type SaveEmailDestinationInput,
  type SaveWebhookDestinationInput,
} from "@/lib/outputs/destination.schema";
import { findFormById } from "@/server/forms/form.repository";
import {
  deleteDestinationWithDeliveries,
  findDestination,
  listDestinationsByForm,
  updateWebhookSecret,
  upsertDestination,
} from "./destination.repository";

export type DestinationView = {
  kind: "email" | "webhook";
  enabled: boolean;
  emails: string[];
  webhookUrl: string | null;
  hasSecret: boolean;
};

const FORM_NOT_FOUND = "No se ha encontrado el formulario.";

function toView(destination: Destination): DestinationView {
  return {
    kind: destination.kind,
    enabled: destination.enabled,
    emails: destination.kind === "email" ? destination.emailTo : [],
    webhookUrl: destination.kind === "webhook" ? destination.webhookUrl : null,
    hasSecret: Boolean(destination.webhookSecret),
  };
}

async function assertForm(organizationId: string, formId: string): Promise<void> {
  const form = await findFormById(organizationId, formId);
  if (!form || form.archivedAt) throw new NotFoundError(FORM_NOT_FOUND);
}

function newSecret(): string {
  return `whsec_${randomBytes(32).toString("hex")}`;
}

/** Cubre: RF-OUT-01, RF-OUT-07, CA-OUT-09 */
export async function getDestinations(organizationId: string, formId: string): Promise<DestinationView[]> {
  await assertForm(organizationId, formId);
  return (await listDestinationsByForm(organizationId, formId)).map(toView);
}

/** Cubre: RF-OUT-01, RF-OUT-16 */
export async function saveEmailDestination(
  organizationId: string,
  formId: string,
  input: SaveEmailDestinationInput,
): Promise<DestinationView> {
  await assertForm(organizationId, formId);
  const data = saveEmailDestinationSchema.parse(input);
  const saved = await upsertDestination(organizationId, formId, "email", {
    enabled: data.enabled,
    emailTo: data.emails,
  });
  return toView(saved);
}

/**
 * Si el destino no existía genera el secreto y lo devuelve en `secret`;
 * si existía, `secret: null`.
 *
 * Cubre: RF-OUT-07, RF-OUT-14, RF-OUT-15
 */
export async function saveWebhookDestination(
  organizationId: string,
  formId: string,
  input: SaveWebhookDestinationInput,
): Promise<{ destination: DestinationView; secret: string | null }> {
  await assertForm(organizationId, formId);
  const data = saveWebhookDestinationSchema.parse(input);
  const existing = await findDestination(organizationId, formId, "webhook");
  const secret = existing?.webhookSecret ? null : newSecret();
  const saved = await upsertDestination(organizationId, formId, "webhook", {
    enabled: data.enabled,
    webhookUrl: data.url,
    ...(secret ? { webhookSecret: secret } : {}),
  });
  return { destination: toView(saved), secret };
}

/** NotFoundError si no hay webhook. Regenerarlo invalida el anterior. Cubre: RF-OUT-16 */
export async function regenerateWebhookSecret(
  organizationId: string,
  formId: string,
): Promise<{ secret: string }> {
  await assertForm(organizationId, formId);
  const secret = newSecret();
  if (!(await updateWebhookSecret(organizationId, formId, secret))) {
    throw new NotFoundError("No se ha encontrado el destino.");
  }
  return { secret };
}

/** Borra el destino y sus envíos. NotFoundError si no existe. */
export async function removeDestination(
  organizationId: string,
  formId: string,
  kind: DestinationKind,
): Promise<void> {
  await assertForm(organizationId, formId);
  if (!(await deleteDestinationWithDeliveries(organizationId, formId, kind))) {
    throw new NotFoundError("No se ha encontrado el destino.");
  }
}

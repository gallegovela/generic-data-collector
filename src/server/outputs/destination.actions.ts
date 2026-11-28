"use server";

import { revalidatePath } from "next/cache";
import type { DestinationKind } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import {
  saveEmailDestinationSchema,
  saveWebhookDestinationSchema,
  type SaveEmailDestinationInput,
  type SaveWebhookDestinationInput,
} from "@/lib/outputs/destination.schema";
import { requireSession } from "@/server/auth/session";
import {
  regenerateWebhookSecret,
  removeDestination,
  saveEmailDestination,
  saveWebhookDestination,
  type DestinationView,
} from "./destination.service";
import { retryDelivery } from "./delivery.service";

export type DestinationActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; issues?: { path: string; message: string }[] };

const NOT_FOUND = "No se ha encontrado el formulario.";

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof NotFoundError) return { ok: false, error: NOT_FOUND };
  if (error instanceof ConflictError) return { ok: false, error: error.message };
  throw error;
}

function invalid(error: { issues: { path: PropertyKey[]; message: string }[] }): {
  ok: false;
  error: string;
  issues: { path: string; message: string }[];
} {
  return {
    ok: false,
    error: "Datos inválidos.",
    issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  };
}

function refresh(formId: string): void {
  revalidatePath(`/admin/forms/${formId}/destinations`);
}

/** Cubre: RF-OUT-01, RF-OUT-16 */
export async function saveEmailDestinationAction(
  formId: string,
  input: SaveEmailDestinationInput,
): Promise<DestinationActionResult<{ destination: DestinationView }>> {
  const user = await requireSession({ role: "admin" });
  const parsed = saveEmailDestinationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const destination = await saveEmailDestination(user.organizationId, formId, input);
    refresh(formId);
    return { ok: true, destination };
  } catch (error) {
    return failure(error);
  }
}

/** Cubre: RF-OUT-07, RF-OUT-15, CA-OUT-10 */
export async function saveWebhookDestinationAction(
  formId: string,
  input: SaveWebhookDestinationInput,
): Promise<DestinationActionResult<{ destination: DestinationView; secret: string | null }>> {
  const user = await requireSession({ role: "admin" });
  const parsed = saveWebhookDestinationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const result = await saveWebhookDestination(user.organizationId, formId, input);
    refresh(formId);
    return { ok: true, ...result };
  } catch (error) {
    return failure(error);
  }
}

/** Cubre: RF-OUT-16 */
export async function regenerateWebhookSecretAction(
  formId: string,
): Promise<DestinationActionResult<{ secret: string }>> {
  const user = await requireSession({ role: "admin" });
  try {
    const result = await regenerateWebhookSecret(user.organizationId, formId);
    refresh(formId);
    return { ok: true, ...result };
  } catch (error) {
    return failure(error);
  }
}

export async function removeDestinationAction(
  formId: string,
  kind: DestinationKind,
): Promise<DestinationActionResult> {
  const user = await requireSession({ role: "admin" });
  try {
    await removeDestination(user.organizationId, formId, kind);
    refresh(formId);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Cubre: RF-OUT-10, CA-OUT-11 */
export async function retryDeliveryAction(
  formId: string,
  deliveryId: string,
): Promise<DestinationActionResult> {
  const user = await requireSession({ role: "admin" });
  try {
    await retryDelivery(user.organizationId, formId, deliveryId);
    refresh(formId);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

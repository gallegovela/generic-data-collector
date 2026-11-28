import type { Submission } from "@prisma/client";

export type WebhookPayload = {
  event: "submission.created";
  deliveryId: string;
  submission: {
    id: string;
    clientId: string;
    formId: string;
    formTitle: string;
    formVersion: number | null;
    capturedAt: string;
    syncedAt: string;
    submittedByName: string | null;
    answers: Record<string, unknown>;
  };
  form: unknown;
};

/**
 * Sin E/S y determinista. Las fotos y firmas van como `{ key }` (tal como
 * se guardan), nunca como URLs firmadas.
 *
 * Cubre: RF-OUT-08, RF-OUT-18
 */
export function buildWebhookPayload(submission: Submission, deliveryId: string): WebhookPayload {
  const answers =
    typeof submission.answers === "object" &&
    submission.answers !== null &&
    !Array.isArray(submission.answers)
      ? (submission.answers as Record<string, unknown>)
      : {};
  return {
    event: "submission.created",
    deliveryId,
    submission: {
      id: submission.id,
      clientId: submission.clientId,
      formId: submission.formId,
      formTitle: submission.formTitle,
      formVersion: submission.formVersionNumber,
      capturedAt: submission.capturedAt.toISOString(),
      syncedAt: submission.syncedAt.toISOString(),
      submittedByName: submission.submittedByName,
      answers,
    },
    form: submission.formVersionSnapshot,
  };
}

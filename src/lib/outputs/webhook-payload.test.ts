import type { Submission } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildWebhookPayload } from "./webhook-payload";

const submission = {
  id: "s1",
  organizationId: "o1",
  formId: "f1",
  formTitle: "Parte",
  clientId: "c1",
  formVersionSnapshot: { title: "Parte" },
  answers: { photos: [{ key: "org/o1/photo/a.jpg" }] },
  submittedByName: "Ana",
  formVersionId: "v1",
  formVersionNumber: 3,
  submittedByUserId: null,
  capturedAt: new Date("2026-01-01T10:00:00Z"),
  syncedAt: new Date("2026-01-01T10:05:00Z"),
  createdAt: new Date("2026-01-01T10:05:00Z"),
} as Submission;

describe("webhook-payload", () => {
  // Cubre: RF-OUT-08, RF-OUT-18
  it("RF-OUT-08: es determinista y deja las fotos como claves, sin URLs", () => {
    const a = JSON.stringify(buildWebhookPayload(submission, "d1"));
    expect(a).toBe(JSON.stringify(buildWebhookPayload(submission, "d1")));
    const payload = buildWebhookPayload(submission, "d1");
    expect(payload.event).toBe("submission.created");
    expect(payload.submission.formVersion).toBe(3);
    expect(payload.submission.capturedAt).toBe("2026-01-01T10:00:00.000Z");
    expect(payload.form).toEqual({ title: "Parte" });
    expect(a).not.toContain("http");
  });
});

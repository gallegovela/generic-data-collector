import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FILL_RATE_LIMITS, fillSubmissionBodySchema } from "./fill.schema";

const base = () => ({
  clientId: randomUUID(),
  versionId: "v1",
  capturedAt: new Date().toISOString(),
  answers: {},
});

describe("fillSubmissionBodySchema", () => {
  it("acepta un cuerpo válido", () => {
    expect(fillSubmissionBodySchema.safeParse(base()).success).toBe(true);
  });

  it("CA-COL-10: capturedAt posterior a now + 24 h falla", () => {
    const future = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
    expect(fillSubmissionBodySchema.safeParse({ ...base(), capturedAt: future }).success).toBe(false);
    const near = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(fillSubmissionBodySchema.safeParse({ ...base(), capturedAt: near }).success).toBe(true);
  });

  it("rechaza clientId no UUID y fecha no ISO", () => {
    expect(fillSubmissionBodySchema.safeParse({ ...base(), clientId: "x" }).success).toBe(false);
    expect(fillSubmissionBodySchema.safeParse({ ...base(), capturedAt: "ayer" }).success).toBe(false);
  });

  it("FILL_RATE_LIMITS tiene límites positivos", () => {
    expect(FILL_RATE_LIMITS.upload.limit).toBeGreaterThan(0);
    expect(FILL_RATE_LIMITS.submit.limit).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { createSubmissionInputSchema, isOwnFileKey } from "./create-submission.schema";

// Cubre: RF-SUB-03 (PP-SUB-17)
describe("isOwnFileKey", () => {
  const uuid = "3f2b8c1e-0000-4000-8000-000000000001";

  it("acepta una clave propia válida", () => {
    expect(isOwnFileKey("abc", `org/abc/photo/${uuid}.jpg`)).toBe(true);
  });

  it("distingue prefijos parecidos", () => {
    expect(isOwnFileKey("abc", `org/abc/photo/${uuid}.jpg`)).toBe(true);
    expect(isOwnFileKey("abc", `org/abcd/photo/${uuid}.jpg`)).toBe(false);
  });

  it("rechaza prefijo sin barra, barra inicial, '..' y segmentos vacíos", () => {
    expect(isOwnFileKey("abc", "org/abc")).toBe(false);
    expect(isOwnFileKey("abc", "org/abc/")).toBe(false);
    expect(isOwnFileKey("abc", `/org/abc/photo/${uuid}.jpg`)).toBe(false);
    expect(isOwnFileKey("abc", `org/abc/../xyz/${uuid}.jpg`)).toBe(false);
    expect(isOwnFileKey("abc", `org/abc//photo/${uuid}.jpg`)).toBe(false);
  });
});

describe("createSubmissionInputSchema", () => {
  const base = {
    organizationId: "o1",
    actor: { kind: "anonymous" },
    form: { id: "f1", title: "F", versionId: "v1", versionNumber: 1, schema: {} },
    clientId: "3f2b8c1e-0000-4000-8000-000000000001",
    answers: {},
    capturedAt: "2026-03-10T10:00:00Z",
  };

  it("acepta una entrada válida y convierte la fecha", () => {
    const parsed = createSubmissionInputSchema.parse(base);
    expect(parsed.capturedAt).toBeInstanceOf(Date);
  });

  it("rechaza un clientId que no es UUID", () => {
    expect(createSubmissionInputSchema.safeParse({ ...base, clientId: "x" }).success).toBe(false);
  });

  it("rechaza una fecha inválida", () => {
    expect(createSubmissionInputSchema.safeParse({ ...base, capturedAt: "nope" }).success).toBe(false);
  });
});

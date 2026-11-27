import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnauthorizedError,
  UnsupportedMediaTypeError,
  ValidationError,
} from "@/lib/errors";
import { FILL_RATE_LIMITS } from "@/lib/field-collector/fill.schema";
import { SubmissionValidationError } from "@/lib/submissions-dashboard/submission-errors";

const getCurrentUser = vi.fn();
const uploadFillFile = vi.fn();
const submitFill = vi.fn();

vi.mock("@/lib/env", () => ({ getEnv: () => ({ STORAGE_MAX_UPLOAD_BYTES: 10485760 }) }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/server/field-collector/fill.service", () => {
  class FormClosedError extends Error {}
  return {
    FormClosedError,
    uploadFillFile: (...a: unknown[]) => uploadFillFile(...a),
    submitFill: (...a: unknown[]) => submitFill(...a),
  };
});

import { clearFillLimitsForTests } from "@/server/field-collector/fill-rate-limit";
import { FormClosedError } from "@/server/field-collector/fill.service";
import * as filesRoute from "./files/route";
import * as submissionsRoute from "./submissions/route";

const params = { params: Promise.resolve({ slug: "abc123xyz" }) };
const stored = { key: "org/o/photo/x.jpg", kind: "photo", contentType: "image/jpeg", sizeBytes: 3 };

function uploadRequest(fields: { kind?: string; uploadId?: string; ip?: string } = {}): Request {
  const form = new FormData();
  form.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "a.jpg"));
  form.set("kind", fields.kind ?? "photo");
  form.set("uploadId", fields.uploadId ?? randomUUID());
  return new Request("http://localhost/api/public/forms/abc123xyz/files", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": fields.ip ?? "9.9.9.9" },
  });
}

function submitRequest(body: unknown, ip = "9.9.9.9"): Request {
  return new Request("http://localhost/api/public/forms/abc123xyz/submissions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  });
}

const validBody = () => ({
  clientId: randomUUID(),
  versionId: "v1",
  capturedAt: new Date().toISOString(),
  answers: {},
});

beforeEach(() => {
  vi.clearAllMocks();
  clearFillLimitsForTests();
  getCurrentUser.mockResolvedValue(null);
});

describe("POST /api/public/forms/[slug]/files", () => {
  it("201 si es nuevo y 200 si ya existía, con no-store", async () => {
    uploadFillFile.mockResolvedValueOnce({ file: stored, created: true });
    const created = await filesRoute.POST(uploadRequest(), params);
    expect(created.status).toBe(201);
    expect(created.headers.get("Cache-Control")).toBe("no-store");
    expect(await created.json()).toEqual(stored);

    uploadFillFile.mockResolvedValueOnce({ file: stored, created: false });
    expect((await filesRoute.POST(uploadRequest(), params)).status).toBe(200);
  });

  it("CA-COL-10: kind document da 400 y no llega al servicio", async () => {
    const response = await filesRoute.POST(uploadRequest({ kind: "document" }), params);
    expect(response.status).toBe(400);
    expect(uploadFillFile).not.toHaveBeenCalled();
  });

  it("CA-COL-10: más de 10 MB declarados da 413", async () => {
    const request = uploadRequest();
    request.headers.set("content-length", String(20 * 1024 * 1024));
    expect((await filesRoute.POST(request, params)).status).toBe(413);
  });

  it("CA-COL-10: no exporta GET (405 automático)", () => {
    expect("GET" in filesRoute).toBe(false);
    expect("GET" in submissionsRoute).toBe(false);
  });

  it.each([
    [new UnauthorizedError(), 401],
    [new ForbiddenError(), 403],
    [new NotFoundError(), 404],
    [new FormClosedError(), 410],
    [new ConflictError("x"), 409],
    [new PayloadTooLargeError(), 413],
    [new UnsupportedMediaTypeError(), 415],
    [new ValidationError("x"), 400],
    [new Error("boom"), 500],
  ])("traduce %s a %i", async (error, status) => {
    uploadFillFile.mockRejectedValueOnce(error);
    const response = await filesRoute.POST(uploadRequest(), params);
    expect(response.status).toBe(status);
    const json = (await response.json()) as { error: { code: string; message: string } };
    expect(json.error.message).not.toContain("boom");
  });

  it("CA-COL-10: anónimo superado el límite recibe 429 con Retry-After; con sesión no se limita", async () => {
    uploadFillFile.mockResolvedValue({ file: stored, created: true });
    for (let i = 0; i < FILL_RATE_LIMITS.upload.limit; i++) {
      await filesRoute.POST(uploadRequest(), params);
    }
    const limited = await filesRoute.POST(uploadRequest(), params);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);

    getCurrentUser.mockResolvedValue({ id: "u", organizationId: "o" });
    expect((await filesRoute.POST(uploadRequest(), params)).status).toBe(201);
  });
});

describe("POST /api/public/forms/[slug]/submissions", () => {
  it("201 con created y 200 si ya existía", async () => {
    submitFill.mockResolvedValueOnce({ id: "s1", created: true });
    const first = await submissionsRoute.POST(submitRequest(validBody()), params);
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ id: "s1", created: true });

    submitFill.mockResolvedValueOnce({ id: "s1", created: false });
    const second = await submissionsRoute.POST(submitRequest(validBody()), params);
    expect(second.status).toBe(200);
  });

  it("CA-COL-10: honeypot responde 201 como si se hubiera guardado", async () => {
    submitFill.mockResolvedValueOnce({ id: "", created: false });
    const response = await submissionsRoute.POST(
      submitRequest({ ...validBody(), website: "spam" }),
      params,
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "", created: true });
  });

  it("CA-COL-10: capturedAt posterior a now + 24 h da 400", async () => {
    const future = new Date(Date.now() + 48 * 3600_000).toISOString();
    const response = await submissionsRoute.POST(
      submitRequest({ ...validBody(), capturedAt: future }),
      params,
    );
    expect(response.status).toBe(400);
    expect(submitFill).not.toHaveBeenCalled();
  });

  it("400 con fieldErrors en la validación de la respuesta", async () => {
    submitFill.mockRejectedValueOnce(
      new SubmissionValidationError([{ fieldId: "a", message: "obligatorio" }]),
    );
    const response = await submissionsRoute.POST(submitRequest(validBody()), params);
    expect(response.status).toBe(400);
    const json = (await response.json()) as {
      error: { code: string };
      fieldErrors: Array<{ fieldId: string }>;
    };
    expect(json.error.code).toBe("VALIDATION");
    expect(json.fieldErrors).toEqual([{ fieldId: "a", message: "obligatorio" }]);
  });

  it("JSON roto da 400 y cuerpo enorme 413", async () => {
    const broken = new Request("http://localhost/x", { method: "POST", body: "{no" });
    expect((await submissionsRoute.POST(broken, params)).status).toBe(400);
    const big = submitRequest(validBody());
    big.headers.set("content-length", String(10 * 1024 * 1024));
    expect((await submissionsRoute.POST(big, params)).status).toBe(413);
  });

  it.each([
    [new UnauthorizedError(), 401],
    [new ForbiddenError(), 403],
    [new NotFoundError(), 404],
    [new FormClosedError(), 410],
    [new ConflictError("x"), 409],
    [new Error("boom"), 500],
  ])("traduce %s a %i", async (error, status) => {
    submitFill.mockRejectedValueOnce(error);
    expect((await submissionsRoute.POST(submitRequest(validBody()), params)).status).toBe(status);
  });

  it("CA-COL-10: anónimo superado el límite recibe 429 con Retry-After", async () => {
    submitFill.mockResolvedValue({ id: "s", created: true });
    for (let i = 0; i < FILL_RATE_LIMITS.submit.limit; i++) {
      await submissionsRoute.POST(submitRequest(validBody()), params);
    }
    const limited = await submissionsRoute.POST(submitRequest(validBody()), params);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).not.toBeNull();
    // Otra IP no queda bloqueada
    expect((await submissionsRoute.POST(submitRequest(validBody(), "8.8.8.8"), params)).status).toBe(201);
  });
});

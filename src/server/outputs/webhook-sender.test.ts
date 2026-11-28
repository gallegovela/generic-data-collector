import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lookup = vi.fn();
vi.mock("node:dns/promises", () => ({ lookup: (...args: unknown[]) => lookup(...args) }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ WEBHOOK_TIMEOUT_SECONDS: 1 }) }));

import { verifyWebhookSignature } from "@/lib/outputs/webhook-signature";
import { postWebhook } from "./webhook-sender";

const base = { secret: "whsec_x", body: '{"a":1}', deliveryId: "d1" };

describe("webhook-sender", () => {
  beforeEach(() => {
    lookup.mockResolvedValue([{ address: "203.0.113.5", family: 4 }]);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  // Cubre: CA-OUT-10, RF-OUT-15
  it("CA-OUT-10: un host que resuelve a IP privada da BLOCKED_HOST sin llamar a fetch", async () => {
    lookup.mockResolvedValue([{ address: "10.0.0.7", family: 4 }]);
    const fetchImpl = vi.fn();
    const result = await postWebhook({ ...base, url: "https://interno.example.com/h", fetchImpl });
    expect(result).toEqual({ ok: false, error: "BLOCKED_HOST" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("CA-OUT-10: una IP literal privada o un esquema no http se rechazan antes de resolver", async () => {
    const fetchImpl = vi.fn();
    expect(await postWebhook({ ...base, url: "http://169.254.169.254/", fetchImpl })).toEqual({
      ok: false,
      error: "BLOCKED_HOST",
    });
    expect(await postWebhook({ ...base, url: "file:///etc/passwd", fetchImpl })).toEqual({
      ok: false,
      error: "BLOCKED_HOST",
    });
    expect(lookup).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("CA-OUT-10: en producción se rechaza el loopback", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchImpl = vi.fn();
    const result = await postWebhook({ ...base, url: "http://127.0.0.1:9/h", fetchImpl });
    expect(result).toEqual({ ok: false, error: "BLOCKED_HOST" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("CA-OUT-10: un 302 es HTTP_302 y no se sigue; el cuerpo no se lee", async () => {
    const text = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({ status: 302, text, json: text, arrayBuffer: text });
    const result = await postWebhook({ ...base, url: "https://example.com/h", fetchImpl });
    expect(result).toEqual({ ok: false, statusCode: 302, error: "HTTP_302" });
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: "manual", method: "POST" });
    expect(text).not.toHaveBeenCalled();
  });

  it("RF-OUT-15: timeout -> TIMEOUT; otro fallo -> NETWORK", async () => {
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    expect(
      await postWebhook({ ...base, url: "https://example.com/h", fetchImpl: vi.fn().mockRejectedValue(timeout) }),
    ).toEqual({ ok: false, error: "TIMEOUT" });
    expect(
      await postWebhook({ ...base, url: "https://example.com/h", fetchImpl: vi.fn().mockRejectedValue(new Error("x")) }),
    ).toEqual({ ok: false, error: "NETWORK" });
    lookup.mockRejectedValue(new Error("ENOTFOUND"));
    expect(await postWebhook({ ...base, url: "https://nada.example.com/h", fetchImpl: vi.fn() })).toEqual({
      ok: false,
      error: "NETWORK",
    });
  });

  it("RF-OUT-08: un 2xx es ok y la firma de las cabeceras se verifica", async () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const fetchImpl = vi.fn().mockResolvedValue({ status: 204 });
    const result = await postWebhook({ ...base, url: "https://example.com/h", now, fetchImpl });
    expect(result).toEqual({ ok: true, statusCode: 204 });
    const headers = fetchImpl.mock.calls[0][1].headers as Record<string, string>;
    expect(
      verifyWebhookSignature(
        base.secret,
        Number(headers["X-FormIA-Timestamp"]),
        base.body,
        headers["X-FormIA-Signature"],
        { now },
      ),
    ).toBe(true);
    expect(headers["X-FormIA-Event"]).toBe("submission.created");
    expect(headers["X-FormIA-Delivery"]).toBe("d1");
  });
});

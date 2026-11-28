import { describe, expect, it } from "vitest";
import { checkWebhookUrl, isBlockedIp } from "./webhook-url";

const strict = { allowLoopback: false };
const loose = { allowLoopback: true };

describe("webhook-url", () => {
  // Cubre: CA-OUT-10, RF-OUT-15
  it.each([
    "http://10.0.0.5/hook",
    "http://169.254.169.254/",
    "http://192.168.1.1",
    "http://172.16.0.1/",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "http://[::ffff:10.0.0.1]/",
    "http://metadata.internal/",
    "http://impresora.local/",
  ])("CA-OUT-10: rechaza %s por host bloqueado", (raw) => {
    expect(checkWebhookUrl(raw, loose)).toMatchObject({ ok: false, reason: "blocked_host" });
  });

  it("CA-OUT-10: rechaza protocolos, credenciales y basura", () => {
    expect(checkWebhookUrl("ftp://x", strict)).toMatchObject({ ok: false, reason: "protocol" });
    expect(checkWebhookUrl("http://user:pass@example.com", strict)).toMatchObject({
      ok: false,
      reason: "credentials",
    });
    expect(checkWebhookUrl("not a url", strict)).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("CA-OUT-10: acepta URLs públicas", () => {
    expect(checkWebhookUrl("https://example.com/hook", strict).ok).toBe(true);
    expect(checkWebhookUrl("http://203.0.113.5/x", strict).ok).toBe(true);
  });

  it("CA-OUT-10: loopback solo con allowLoopback (en producción se rechaza)", () => {
    for (const raw of ["http://127.0.0.1/", "http://localhost/", "http://[::1]/"]) {
      expect(checkWebhookUrl(raw, loose).ok).toBe(true);
      expect(checkWebhookUrl(raw, strict)).toMatchObject({ ok: false, reason: "blocked_host" });
    }
  });

  it("CA-OUT-10: isBlockedIp ignora lo que no es una IP", () => {
    expect(isBlockedIp("example.com", strict)).toBe(false);
    expect(isBlockedIp("8.8.8.8", strict)).toBe(false);
    expect(isBlockedIp("::", loose)).toBe(true);
    expect(isBlockedIp("2001:4860:4860::8888", strict)).toBe(false);
  });
});

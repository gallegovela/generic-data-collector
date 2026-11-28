import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signWebhookBody, verifyWebhookSignature } from "./webhook-signature";

const SECRET = "whsec_test";
const BODY = '{"a":1}';
const TS = 1_800_000_000;
const NOW = new Date(TS * 1000);

describe("webhook-signature", () => {
  // Cubre: CA-OUT-07, RF-OUT-18
  it("CA-OUT-07: firma conocida HMAC-SHA256 sobre `<timestamp>.<cuerpo>`", () => {
    const expected = createHmac("sha256", SECRET).update(`${TS}.${BODY}`).digest("hex");
    expect(signWebhookBody(SECRET, TS, BODY)).toBe(`sha256=${expected}`);
  });

  it("CA-OUT-07: verify acepta la firma correcta", () => {
    const sig = signWebhookBody(SECRET, TS, BODY);
    expect(verifyWebhookSignature(SECRET, TS, BODY, sig, { now: NOW })).toBe(true);
  });

  it("CA-OUT-07: verify rechaza cuerpo alterado, otro secreto, formato erróneo y marca fuera de tolerancia", () => {
    const sig = signWebhookBody(SECRET, TS, BODY);
    expect(verifyWebhookSignature(SECRET, TS, '{"a":2}', sig, { now: NOW })).toBe(false);
    expect(verifyWebhookSignature("otro", TS, BODY, sig, { now: NOW })).toBe(false);
    expect(verifyWebhookSignature(SECRET, TS, BODY, "sha256=zz", { now: NOW })).toBe(false);
    expect(verifyWebhookSignature(SECRET, TS, BODY, sig.replace("sha256=", ""), { now: NOW })).toBe(false);
    expect(verifyWebhookSignature(SECRET, TS, BODY, sig, { now: new Date((TS + 301) * 1000) })).toBe(false);
    expect(verifyWebhookSignature(SECRET, TS, BODY, sig, { now: new Date((TS + 299) * 1000) })).toBe(true);
  });
});

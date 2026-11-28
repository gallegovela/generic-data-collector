import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_SIGNATURE_HEADER = "X-FormIA-Signature";
export const WEBHOOK_TIMESTAMP_HEADER = "X-FormIA-Timestamp";
export const WEBHOOK_EVENT_HEADER = "X-FormIA-Event";
export const WEBHOOK_DELIVERY_HEADER = "X-FormIA-Delivery";

/**
 * "sha256=" + hex(HMAC-SHA256(secret, `${timestamp}.${body}`)).
 *
 * Cubre: RF-OUT-18, CA-OUT-07
 */
export function signWebhookBody(secret: string, timestamp: number, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

/** Comparación en tiempo constante; false con formato erróneo o marca de tiempo fuera de tolerancia. */
export function verifyWebhookSignature(
  secret: string,
  timestamp: number,
  body: string,
  header: string,
  opts?: { toleranceSeconds?: number; now?: Date },
): boolean {
  if (!/^sha256=[0-9a-f]{64}$/.test(header)) return false;
  const tolerance = opts?.toleranceSeconds ?? 300;
  const nowSeconds = Math.floor((opts?.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - timestamp) > tolerance) return false;
  const expected = Buffer.from(signWebhookBody(secret, timestamp, body));
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

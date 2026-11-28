import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getEnv } from "@/lib/env";
import { checkWebhookUrl, isBlockedIp } from "@/lib/outputs/webhook-url";
import {
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  signWebhookBody,
} from "@/lib/outputs/webhook-signature";

export type WebhookResult =
  | { ok: true; statusCode: number }
  | { ok: false; statusCode?: number; error: "TIMEOUT" | "NETWORK" | "BLOCKED_HOST" | `HTTP_${number}` };

function isTimeout(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

/**
 * POST firmado. Protección SSRF: valida la URL, resuelve el DNS y rechaza
 * direcciones privadas; `redirect: "manual"` y espera máxima. No lee ni
 * guarda el cuerpo de la respuesta ni registra URL ni secreto.
 *
 * Limitación conocida: la comprobación DNS y la conexión resuelven por
 * separado (DNS rebinding).
 *
 * Cubre: RF-OUT-08, RF-OUT-15, CA-OUT-10
 */
export async function postWebhook(input: {
  url: string;
  secret: string;
  body: string;
  deliveryId: string;
  now?: Date;
  fetchImpl?: typeof fetch;
}): Promise<WebhookResult> {
  const allowLoopback = process.env.NODE_ENV !== "production";
  const check = checkWebhookUrl(input.url, { allowLoopback });
  if (!check.ok) return { ok: false, error: "BLOCKED_HOST" };

  const host = check.url.hostname.replace(/^\[|\]$/g, "");
  if (!isIP(host)) {
    try {
      const addresses = await lookup(host, { all: true });
      if (addresses.length === 0) return { ok: false, error: "NETWORK" };
      if (addresses.some((a) => isBlockedIp(a.address, { allowLoopback }))) {
        return { ok: false, error: "BLOCKED_HOST" };
      }
    } catch {
      return { ok: false, error: "NETWORK" };
    }
  }

  const timestamp = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(check.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(getEnv().WEBHOOK_TIMEOUT_SECONDS * 1000),
      headers: {
        "Content-Type": "application/json",
        [WEBHOOK_SIGNATURE_HEADER]: signWebhookBody(input.secret, timestamp, input.body),
        [WEBHOOK_TIMESTAMP_HEADER]: String(timestamp),
        [WEBHOOK_EVENT_HEADER]: "submission.created",
        [WEBHOOK_DELIVERY_HEADER]: input.deliveryId,
      },
      body: input.body,
    });
    if (response.status >= 200 && response.status < 300) {
      return { ok: true, statusCode: response.status };
    }
    return { ok: false, statusCode: response.status, error: `HTTP_${response.status}` };
  } catch (error) {
    return { ok: false, error: isTimeout(error) ? "TIMEOUT" : "NETWORK" };
  }
}

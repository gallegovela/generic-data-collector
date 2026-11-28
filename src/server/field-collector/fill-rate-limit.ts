import { createHash } from "node:crypto";
import { RateLimitError } from "@/lib/errors";
import { FILL_RATE_LIMITS } from "@/lib/field-collector/fill.schema";

/**
 * Límite de tasa del modo público. Contador propio, separado del de login
 * (`server/auth/rate-limit.ts`): una inundación de IPs falsas nunca desplaza
 * los fallos de login. En memoria por proceso; con varias instancias hará
 * falta un almacén compartido.
 *
 * Cubre: RF-COL-19, CA-COL-10
 */

export const MAX_FILL_KEYS = 10_000;

const marks = new Map<string, number[]>();

function defaultHops(): number {
  const value = Number(process.env.TRUSTED_PROXY_HOPS);
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

/**
 * IP del cliente según `x-forwarded-for`, contando `hops` desde el FINAL
 * (el primer valor lo escribe el cliente y no se usa).
 */
export function clientIp(headers: Headers, hops: number = defaultHops()): string {
  const raw = headers.get("x-forwarded-for");
  if (!raw) return "unknown";
  const values = raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "");
  if (values.length === 0) return "unknown";
  if (values.length < hops) return values[0];
  return values[values.length - hops];
}

function prune(key: string, windowMs: number, now: number): number[] {
  const recent = (marks.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length === 0) marks.delete(key);
  else marks.set(key, recent);
  return recent;
}

/** Lanza `RateLimitError` (429) si esa IP ya agotó el cupo de `kind` en ese formulario. */
export function assertWithinFillLimit(kind: "upload" | "submit", slug: string, ip: string): void {
  const { limit, windowMs } = FILL_RATE_LIMITS[kind];
  const key = `fill:${kind}:${slug}:${createHash("sha256").update(ip).digest("hex")}`;
  const now = Date.now();
  const recent = prune(key, windowMs, now);

  if (recent.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    throw new RateLimitError(undefined, retryAfter);
  }

  recent.push(now);
  marks.set(key, recent);

  if (marks.size > MAX_FILL_KEYS) {
    for (const other of Array.from(marks.keys())) prune(other, windowMs, now);
    for (const oldest of Array.from(marks.keys())) {
      if (marks.size <= MAX_FILL_KEYS) break;
      if (oldest !== key) marks.delete(oldest);
    }
  }
}

/** Solo para tests. */
export function clearFillLimitsForTests(): void {
  marks.clear();
}

/** Solo para tests. */
export function trackedFillKeys(): number {
  return marks.size;
}

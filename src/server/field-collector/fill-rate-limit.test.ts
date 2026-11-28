import { afterEach, describe, expect, it } from "vitest";
import { RateLimitError } from "@/lib/errors";
import { FILL_RATE_LIMITS } from "@/lib/field-collector/fill.schema";
import { clearAllForTests, isBlocked, recordFailure } from "@/server/auth/rate-limit";
import {
  MAX_FILL_KEYS,
  assertWithinFillLimit,
  clearFillLimitsForTests,
  clientIp,
  trackedFillKeys,
} from "./fill-rate-limit";

afterEach(() => {
  clearFillLimitsForTests();
  clearAllForTests();
});

describe("clientIp", () => {
  it("CA-COL-10: con x-forwarded-for 'a, b' y 1 salto usa b", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "a, b" }), 1)).toBe("b");
    expect(clientIp(new Headers({ "x-forwarded-for": "falso, b" }), 1)).toBe("b");
  });

  it("cuenta los saltos desde el final", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "a, b, c" }), 2)).toBe("b");
  });

  it("con menos valores que saltos usa el primero", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "a" }), 3)).toBe("a");
  });

  it("sin cabecera o vacía devuelve unknown", () => {
    expect(clientIp(new Headers())).toBe("unknown");
    expect(clientIp(new Headers({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});

describe("assertWithinFillLimit", () => {
  it("CA-COL-10: tras el límite lanza 429 con Retry-After", () => {
    const { limit, windowMs } = FILL_RATE_LIMITS.submit;
    for (let i = 0; i < limit; i++) assertWithinFillLimit("submit", "slug1", "1.1.1.1");
    try {
      assertWithinFillLimit("submit", "slug1", "1.1.1.1");
      throw new Error("debía lanzar");
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      const seconds = (error as RateLimitError).retryAfterSeconds ?? 0;
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(windowMs / 1000);
    }
  });

  it("CA-COL-10: la subida tiene su propio cupo y otro formulario u otra IP no se bloquean", () => {
    const { limit } = FILL_RATE_LIMITS.submit;
    for (let i = 0; i < limit; i++) assertWithinFillLimit("submit", "slug1", "1.1.1.1");
    expect(() => assertWithinFillLimit("upload", "slug1", "1.1.1.1")).not.toThrow();
    expect(() => assertWithinFillLimit("submit", "slug2", "1.1.1.1")).not.toThrow();
    expect(() => assertWithinFillLimit("submit", "slug1", "2.2.2.2")).not.toThrow();
  });

  it("CA-COL-10: el contador de fill no desplaza las claves de login", () => {
    recordFailure("login:victima");
    for (let i = 0; i < MAX_FILL_KEYS + 50; i++) assertWithinFillLimit("upload", "s", `ip-${i}`);
    expect(trackedFillKeys()).toBeLessThanOrEqual(MAX_FILL_KEYS);
    for (let i = 0; i < 4; i++) recordFailure("login:victima");
    expect(isBlocked("login:victima")).toBe(true);
  });
});

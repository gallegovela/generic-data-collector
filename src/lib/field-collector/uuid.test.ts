import { afterEach, describe, expect, it, vi } from "vitest";
import { newUuid } from "./uuid";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newUuid", () => {
  afterEach(() => vi.restoreAllMocks());

  it("genera un UUID v4", () => {
    expect(newUuid()).toMatch(UUID_V4);
  });

  it("sin crypto.randomUUID (contexto no seguro) también genera un UUID v4 válido", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const a = newUuid();
      expect(a).toMatch(UUID_V4);
      expect(newUuid()).not.toBe(a);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});

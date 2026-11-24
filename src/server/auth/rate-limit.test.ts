import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_TRACKED_KEYS,
  clearAllForTests,
  isBlocked,
  recordFailure,
  reset,
} from "./rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAllForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Cubre: RNF-AUT-04
  it("isBlocked no consume cupo", () => {
    for (let i = 0; i < 20; i++) {
      expect(isBlocked("a")).toBe(false);
    }
  });

  // Cubre: RNF-AUT-04, CA-AUT-08
  it("5 fallos bloquean y reset desbloquea", () => {
    for (let i = 0; i < 4; i++) {
      recordFailure("a");
    }
    expect(isBlocked("a")).toBe(false);

    recordFailure("a");
    expect(isBlocked("a")).toBe(true);
    expect(isBlocked("b")).toBe(false);

    reset("a");
    expect(isBlocked("a")).toBe(false);
  });

  // Cubre: RNF-AUT-04, CA-AUT-08
  it("las marcas caducadas se purgan al pasar la ventana", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure("a");
    }
    expect(isBlocked("a")).toBe(true);

    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(isBlocked("a")).toBe(false);
  });

  // Cubre: RNF-AUT-04
  it("el Map respeta MAX_TRACKED_KEYS", () => {
    for (let i = 0; i < MAX_TRACKED_KEYS + 50; i++) {
      recordFailure(`k${i}`);
    }

    // Las más antiguas se eliminan; la última sigue contada.
    recordFailure(`k${MAX_TRACKED_KEYS + 49}`);
    expect(isBlocked("k0")).toBe(false);
    expect(isBlocked(`k${MAX_TRACKED_KEYS + 49}`)).toBe(false);
    for (let i = 0; i < 3; i++) {
      recordFailure(`k${MAX_TRACKED_KEYS + 49}`);
    }
    expect(isBlocked(`k${MAX_TRACKED_KEYS + 49}`, 5)).toBe(true);
  });

  // Cubre: RNF-AUT-04
  it("al superar el tope elimina primero las claves caducadas", () => {
    recordFailure("old");
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    for (let i = 0; i < MAX_TRACKED_KEYS; i++) {
      recordFailure(`k${i}`);
    }

    for (let i = 0; i < 5; i++) {
      recordFailure("k0");
    }
    expect(isBlocked("k0")).toBe(true);
  });
});

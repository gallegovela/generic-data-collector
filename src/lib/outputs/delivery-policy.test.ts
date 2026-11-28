import { describe, expect, it } from "vitest";
import { MAX_DELIVERY_ATTEMPTS, nextAttemptDelaySeconds } from "./delivery-policy";

describe("delivery-policy", () => {
  // Cubre: RF-OUT-09, CA-OUT-03
  it("RF-OUT-09: esperas 60/300/1800/7200 y null al 5.º intento", () => {
    expect([1, 2, 3, 4].map(nextAttemptDelaySeconds)).toEqual([60, 300, 1800, 7200]);
    expect(MAX_DELIVERY_ATTEMPTS).toBe(5);
    expect(nextAttemptDelaySeconds(5)).toBeNull();
    expect(nextAttemptDelaySeconds(9)).toBeNull();
    expect(nextAttemptDelaySeconds(0)).toBeNull();
  });
});

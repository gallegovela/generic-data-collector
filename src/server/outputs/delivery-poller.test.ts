import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const processDueDeliveries = vi.fn();
const env = { DELIVERY_POLLER_ENABLED: true, DELIVERY_POLL_INTERVAL_SECONDS: 30 };
vi.mock("./delivery.service", () => ({ processDueDeliveries: (...a: unknown[]) => processDueDeliveries(...a) }));
vi.mock("@/lib/env", () => ({ getEnv: () => env }));

import { startDeliveryPoller } from "./delivery-poller";

const flag = globalThis as unknown as { deliveryPollerStarted?: boolean };

describe("delivery-poller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    processDueDeliveries.mockResolvedValue(0);
    delete flag.deliveryPollerStarted;
    env.DELIVERY_POLLER_ENABLED = true;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    delete flag.deliveryPollerStarted;
  });

  // Cubre: RNF-OUT-06
  it("RNF-OUT-06: ejecuta un ciclo al arrancar y es idempotente (un solo intervalo)", async () => {
    startDeliveryPoller();
    startDeliveryPoller();
    await vi.advanceTimersByTimeAsync(0);
    expect(processDueDeliveries).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(processDueDeliveries).toHaveBeenCalledTimes(2);
  });

  it("RNF-OUT-06: no arranca con DELIVERY_POLLER_ENABLED=false", async () => {
    env.DELIVERY_POLLER_ENABLED = false;
    startDeliveryPoller();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(processDueDeliveries).not.toHaveBeenCalled();
  });

  it("RNF-OUT-06: un ciclo en curso no se solapa con el siguiente y los errores no lo paran", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let release: () => void = () => {};
    processDueDeliveries.mockImplementationOnce(() => new Promise<number>((r) => (release = () => r(0))));
    startDeliveryPoller();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(processDueDeliveries).toHaveBeenCalledTimes(1);
    processDueDeliveries.mockRejectedValue(new Error("boom"));
    release();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(processDueDeliveries).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(processDueDeliveries).toHaveBeenCalledTimes(3);
  });
});

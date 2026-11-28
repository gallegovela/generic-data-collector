import { getEnv } from "@/lib/env";
import { processDueDeliveries } from "./delivery.service";

const globalForPoller = globalThis as unknown as { deliveryPollerStarted?: boolean };

/**
 * Idempotente. Ejecuta `processDueDeliveries` ya y cada
 * DELIVERY_POLL_INTERVAL_SECONDS; un ciclo en curso no se solapa con el
 * siguiente y los errores se registran sin contenido. Sin proceso vivo no
 * hay reintentos (limitación del piloto).
 *
 * Cubre: RNF-OUT-06
 */
export function startDeliveryPoller(): void {
  const env = getEnv();
  if (!env.DELIVERY_POLLER_ENABLED || globalForPoller.deliveryPollerStarted) return;
  globalForPoller.deliveryPollerStarted = true;

  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await processDueDeliveries();
    } catch {
      console.error(JSON.stringify({ event: "delivery.poller_error" }));
    } finally {
      running = false;
    }
  };

  void tick();
  setInterval(() => void tick(), env.DELIVERY_POLL_INTERVAL_SECONDS * 1000).unref();
}

import { getEnv } from "@/lib/env";
import {
  logRequestError,
  type RequestErrorContext,
  type RequestErrorRequest,
} from "@/server/platform/error-log";

/**
 * Se ejecuta una vez por instancia del servidor, antes de aceptar
 * tráfico (ver https://nextjs.org/docs/app/guides/instrumentation).
 * Si `getEnv()` lanza un error (variables de entorno ausentes o
 * inválidas), se deja propagar para que el proceso no arranque.
 *
 * En runtime Node arranca además el procesador de envíos de `outputs`
 * (reanuda los pendientes tras un reinicio, RNF-OUT-06).
 *
 * Cubre: RF-PLT-03, RNF-OUT-06.
 */
export async function register(): Promise<void> {
  getEnv();
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDeliveryPoller } = await import("@/server/outputs/delivery-poller");
    startDeliveryPoller();
  }
}

/**
 * Next.js la llama con cada error no capturado en el servidor (route
 * handlers, server components, server actions y middleware).
 *
 * Cubre: RNF-PLT-05.
 */
export function onRequestError(
  error: unknown,
  request: RequestErrorRequest,
  context: RequestErrorContext,
): void {
  logRequestError(error, request, context);
}

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
 * Cubre: RF-PLT-03.
 */
export function register(): void {
  getEnv();
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

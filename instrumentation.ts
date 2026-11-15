import { getEnv } from "@/lib/env";

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

import { connection, NextResponse } from "next/server";
import { checkHealth } from "@/server/platform/health.service";

/**
 * Endpoint público de monitorización: no requiere rol ni filtra por
 * organización, solo informa de `ok`/`error` por dependencia.
 *
 * Cubre: RF-PLT-08, CA-PLT-04.
 */
export async function GET(): Promise<Response> {
  // Siempre en el momento de la petición: sin esto, Next.js intenta
  // generarla al construir (Cache Components), sin variables de entorno
  // ni servicios, y el build de la imagen falla.
  await connection();
  const result = await checkHealth();

  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 503,
  });
}

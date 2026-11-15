import { getEnv } from "@/lib/env";
import { prisma } from "@/server/db/client";

export type HealthStatus = "ok" | "error";

export type HealthCheckResult = {
  status: HealthStatus;
  checks: { database: HealthStatus; storage: HealthStatus };
};

const STORAGE_CHECK_TIMEOUT_MS = 2000;

async function defaultCheckDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function defaultCheckStorage(): Promise<boolean> {
  const { S3_ENDPOINT } = getEnv();

  try {
    // Cualquier respuesta HTTP (incluido un 403 de MinIO sin
    // credenciales) demuestra que el almacenamiento es accesible por
    // red; solo un error de red cuenta como "error".
    await fetch(S3_ENDPOINT, { signal: AbortSignal.timeout(STORAGE_CHECK_TIMEOUT_MS) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Comprueba la base de datos y el almacenamiento. Las comprobaciones
 * son inyectables para los tests.
 *
 * Cubre: RF-PLT-08, CA-PLT-04.
 */
export async function checkHealth(
  checkDatabase: () => Promise<boolean> = defaultCheckDatabase,
  checkStorage: () => Promise<boolean> = defaultCheckStorage,
): Promise<HealthCheckResult> {
  const [databaseOk, storageOk] = await Promise.all([checkDatabase(), checkStorage()]);

  const checks = {
    database: databaseOk ? ("ok" as const) : ("error" as const),
    storage: storageOk ? ("ok" as const) : ("error" as const),
  };

  return {
    status: databaseOk && storageOk ? "ok" : "error",
    checks,
  };
}

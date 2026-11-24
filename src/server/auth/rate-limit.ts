/**
 * Límite de fallos de login en memoria por proceso (ventana deslizante
 * con un Map de marcas de tiempo). Suficiente para el piloto de una sola
 * instancia; se pierde al reiniciar y no se comparte entre instancias.
 * Solo cuentan los fallos. Ver
 * specs/tenancy-auth/design.md#seguridad-y-privacidad.
 *
 * Cubre: RNF-AUT-04.
 */

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

export const MAX_TRACKED_KEYS = 10_000;

const failures = new Map<string, number[]>();

function purgeKey(key: string, windowMs: number, now: number): number[] {
  const recent = (failures.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

  if (recent.length === 0) {
    failures.delete(key);
  } else {
    failures.set(key, recent);
  }

  return recent;
}

/** `true` si `key` tiene `limit` o más fallos dentro de la ventana. No consume cupo. */
export function isBlocked(
  key: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS,
): boolean {
  return purgeKey(key, windowMs, Date.now()).length >= limit;
}

/** Añade un fallo de `key` ahora y mantiene el Map por debajo de MAX_TRACKED_KEYS. */
export function recordFailure(key: string, windowMs: number = DEFAULT_WINDOW_MS): void {
  const now = Date.now();
  const recent = purgeKey(key, windowMs, now);

  recent.push(now);
  failures.set(key, recent);

  if (failures.size <= MAX_TRACKED_KEYS) {
    return;
  }

  for (const otherKey of Array.from(failures.keys())) {
    purgeKey(otherKey, windowMs, now);
  }

  for (const oldestKey of Array.from(failures.keys())) {
    if (failures.size <= MAX_TRACKED_KEYS) {
      break;
    }

    if (oldestKey !== key) {
      failures.delete(oldestKey);
    }
  }
}

/** Borra el contador de `key` (login correcto). */
export function reset(key: string): void {
  failures.delete(key);
}

/** Solo para tests. */
export function clearAllForTests(): void {
  failures.clear();
}

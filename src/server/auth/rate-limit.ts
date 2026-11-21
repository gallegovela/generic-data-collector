/**
 * Límite de intentos en memoria por proceso (ventana deslizante simple
 * con un Map). Suficiente para el piloto de una sola instancia; se
 * pierde al reiniciar el proceso y no se comparte entre instancias —
 * no bloquea el piloto (CLAUDE.md: "no sobredimensionar"). Ver
 * specs/tenancy-auth/design.md#seguridad-y-privacidad.
 *
 * Cubre: RNF-AUT-04.
 */

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

const attempts = new Map<string, number[]>();

/**
 * Registra un intento para `key` y comprueba el límite. Devuelve
 * `true` si el intento está permitido (y lo cuenta), `false` si ya se
 * ha superado el límite en la ventana de tiempo.
 */
export function checkAndConsume(
  key: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS,
): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

  if (recent.length >= limit) {
    attempts.set(key, recent);
    return false;
  }

  recent.push(now);
  attempts.set(key, recent);
  return true;
}

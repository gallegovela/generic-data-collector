export const MAX_DELIVERY_ATTEMPTS = 5;
export const DELIVERY_BACKOFF_SECONDS = [60, 300, 1800, 7200] as const;
export const STUCK_SENDING_SECONDS = 300;

/**
 * Espera tras el intento nº `attemptsDone` (1..), o null si ya no quedan
 * (attemptsDone >= 5).
 *
 * Cubre: RF-OUT-09
 */
export function nextAttemptDelaySeconds(attemptsDone: number): number | null {
  if (attemptsDone < 1 || attemptsDone >= MAX_DELIVERY_ATTEMPTS) return null;
  return DELIVERY_BACKOFF_SECONDS[attemptsDone - 1] ?? null;
}

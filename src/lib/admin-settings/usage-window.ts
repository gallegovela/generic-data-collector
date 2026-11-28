/** Inicio de la hora natural UTC de `now`. Cubre: RF-SET-08 */
export function currentWindowStart(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()),
  );
}

import { z } from "zod";

/**
 * Esquemas del módulo admin-settings (planes de uso).
 *
 * Cubre: RF-SET-03, RF-SET-04, RF-SET-09
 */

export const DEFAULT_PLAN_ID = "plan-generic";

const limit = z
  .number("Indica un número.")
  .int("Debe ser un número entero.")
  .positive("Debe ser mayor que 0.")
  .max(2_147_483_647, "El valor es demasiado grande.")
  .nullable();

export const planInputSchema = z.object({
  name: z.string().trim().min(1, "Indica un nombre.").max(80, "El nombre es demasiado largo."),
  maxImpressionsPerHour: limit,
  maxSubmissionsPerHour: limit,
  maxFileBytes: limit,
});

export type PlanInput = z.infer<typeof planInputSchema>;

export const planIdSchema = z.string().min(1).max(100);

const BYTES_PER_MB = 1048576;

/** Convierte MB (texto del formulario, decimal) a bytes; vacío = null. */
export function mbToBytes(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const mb = Number(value.replace(",", "."));
  if (!Number.isFinite(mb)) return Number.NaN;
  return Math.round(mb * BYTES_PER_MB);
}

/** `1048576` → "1 MB"; `524288` → "0,5 MB". */
export function formatMb(bytes: number): string {
  const mb = Math.round((bytes / BYTES_PER_MB) * 10) / 10;
  return `${String(mb).replace(".", ",")} MB`;
}

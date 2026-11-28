import { z } from "zod";

/** Margen de reloj admitido para `capturedAt` hacia el futuro. */
export const MAX_CAPTURED_AT_FUTURE_MS = 24 * 60 * 60 * 1000;

/**
 * Cuerpo de `POST /api/public/forms/[slug]/submissions`. El actor y la
 * organización nunca vienen del cliente.
 *
 * Cubre: RF-COL-08, RF-COL-19, CA-COL-10
 */
export const fillSubmissionBodySchema = z.object({
  clientId: z.string().uuid(),
  versionId: z.string().min(1),
  capturedAt: z
    .string()
    .datetime()
    .refine((value) => Date.parse(value) <= Date.now() + MAX_CAPTURED_AT_FUTURE_MS, {
      message: "La fecha de captura no es válida.",
    }),
  answers: z.record(z.string(), z.unknown()),
  website: z.string().optional(),
});
export type FillSubmissionBody = z.infer<typeof fillSubmissionBodySchema>;

function positiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const WINDOW_MS = 10 * 60_000;

/** Valores por defecto sobrescribibles por FILL_RATE_LIMIT_UPLOAD / FILL_RATE_LIMIT_SUBMIT. */
export const FILL_RATE_LIMITS = {
  upload: { limit: positiveInt(process.env.FILL_RATE_LIMIT_UPLOAD, 200), windowMs: WINDOW_MS },
  submit: { limit: positiveInt(process.env.FILL_RATE_LIMIT_SUBMIT, 60), windowMs: WINDOW_MS },
} as const;

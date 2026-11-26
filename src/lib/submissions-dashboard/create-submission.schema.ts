import { z } from "zod";

/** Tamaño máximo de JSON.stringify(answers) en UTF-8. */
export const MAX_SUBMISSION_ANSWERS_BYTES = 256 * 1024;

/** Cubre: RF-SUB-01, RF-SUB-02, RF-SUB-04 */
export const createSubmissionInputSchema = z.object({
  // Lo decide quien llama, nunca el cuerpo de una petición.
  organizationId: z.string().min(1),
  actor: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("user"),
      userId: z.string().min(1),
      userName: z.string().min(1),
      userOrganizationId: z.string().min(1),
    }),
    z.object({ kind: z.literal("anonymous") }),
  ]),
  form: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    versionId: z.string().min(1),
    versionNumber: z.number().int().positive(),
    // Se parsea con FormVersionSchema dentro del servicio.
    schema: z.unknown(),
  }),
  clientId: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()),
  capturedAt: z.coerce.date(),
});
export type CreateSubmissionInput = z.input<typeof createSubmissionInputSchema>;

/**
 * Clave de archivo propia (RF-STO-01: `org/<organizationId>/<tipo>/<uuid>.<ext>`):
 * prefijo exacto con barra final, sin barra inicial, sin `..` ni segmentos vacíos,
 * y al menos un segmento tras el prefijo.
 */
export function isOwnFileKey(organizationId: string, key: string): boolean {
  if (!organizationId || organizationId.includes("/")) return false;
  const prefix = `org/${organizationId}/`;
  if (!key.startsWith(prefix)) return false;
  const rest = key.slice(prefix.length);
  if (rest.length === 0) return false;
  const segments = rest.split("/");
  return segments.every((s) => s !== "" && s !== "." && s !== "..");
}

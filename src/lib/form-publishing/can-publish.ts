export type AutosavePhase = "idle" | "saving" | "saved" | "invalid" | "error";

/**
 * Solo se puede publicar si el servidor tiene el mismo borrador que ve el
 * admin: sin guardado pendiente, en curso, inválido ni fallido.
 *
 * Cubre: RF-PUB-01
 */
export function canPublishDraft(phase: AutosavePhase, isPending: boolean): boolean {
  return !isPending && phase !== "saving" && phase !== "invalid" && phase !== "error";
}

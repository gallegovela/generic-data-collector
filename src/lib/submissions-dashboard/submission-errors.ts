import { ValidationError } from "@/lib/errors";
import type { FieldValidationError } from "@/lib/form-schema";

/**
 * Errores por campo. NUNCA incluye valores de respuesta, solo fieldId y mensaje.
 * fieldId === "_" para errores que no son de un campo (tamaño, fecha, esquema).
 *
 * Cubre: RF-SUB-03, RNF-SUB-03
 */
export class SubmissionValidationError extends ValidationError {
  constructor(public readonly fieldErrors: FieldValidationError[]) {
    super("La respuesta no es válida.");
    this.name = "SubmissionValidationError";
  }
}

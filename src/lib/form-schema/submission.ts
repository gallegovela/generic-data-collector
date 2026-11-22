import { buildFieldAnswerSchema } from "./answer.schema";
import { evaluateCondition, isAnswered } from "./condition.schema";
import type { Field } from "./field.schema";
import type { FormVersion } from "./form-version.schema";

export type FieldValidationError = { fieldId: string; message: string };
export type SubmissionValidationResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; errors: FieldValidationError[] };

export function isFieldVisible(field: Field, answers: Record<string, unknown>): boolean {
  return !field.visibleIf || evaluateCondition(field.visibleIf, answers);
}

export function getVisibleFields(form: FormVersion, answers: Record<string, unknown>): Field[] {
  return form.fields.filter((f) => isFieldVisible(f, answers));
}

export function validateSubmission(
  form: FormVersion,
  answers: Record<string, unknown>,
): SubmissionValidationResult {
  const data: Record<string, unknown> = {};
  const errors: FieldValidationError[] = [];

  for (const field of form.fields) {
    if (field.type === "section") continue;
    if (!isFieldVisible(field, answers)) continue;
    const value = answers[field.id];
    if (!isAnswered(value)) {
      if (field.required) {
        errors.push({ fieldId: field.id, message: `"${field.label}" es obligatorio.` });
      }
      continue;
    }
    const result = buildFieldAnswerSchema(field).safeParse(value);
    if (result.success) {
      data[field.id] = result.data;
    } else {
      errors.push({ fieldId: field.id, message: result.error.issues.map((i) => i.message).join("; ") });
    }
  }

  return errors.length > 0 ? { success: false, errors } : { success: true, data };
}

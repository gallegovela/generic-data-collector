import { isAnswered, isFieldVisible, type FormVersion } from "@/lib/form-schema";

/** Respuestas vacías de partida (clave ausente = sin responder). */
export function emptyAnswers(): Record<string, unknown> {
  return {};
}

/** `true` si algún valor cuenta como respondido. */
export function hasAnyAnswer(answers: Record<string, unknown>): boolean {
  return Object.values(answers).some((value) => isAnswered(value));
}

function refKey(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const key = (value as { key?: unknown }).key;
  return typeof key === "string" && key !== "" ? key : null;
}

/** Claves de archivo de los campos photo/signature visibles. */
export function collectFileKeys(schema: FormVersion, answers: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const field of schema.fields) {
    if (field.type !== "photo" && field.type !== "signature") continue;
    if (!isFieldVisible(field, answers)) continue;
    const value = answers[field.id];
    const refs = Array.isArray(value) ? value : value === undefined ? [] : [value];
    for (const ref of refs) {
      const key = refKey(ref);
      if (key) keys.push(key);
    }
  }
  return keys;
}

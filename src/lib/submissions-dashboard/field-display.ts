import type { Field, FileRef, GpsAnswer } from "@/lib/form-schema";

export type FieldDisplayValue =
  | { kind: "section"; title: string; description?: string }
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "photos"; files: FileRef[] }
  | { kind: "signature"; file: FileRef }
  | { kind: "gps"; value: GpsAnswer };

function optionLabel(options: { id: string; label: string }[], id: unknown): string {
  return options.find((o) => o.id === id)?.label ?? String(id);
}

/** Traduce un campo y las respuestas a lo que hay que pintar en la ficha. Cubre: RF-SUB-08 */
export function buildFieldDisplayValue(field: Field, answers: Record<string, unknown>): FieldDisplayValue {
  if (field.type === "section") {
    return { kind: "section", title: field.label, description: field.description };
  }
  const value = answers[field.id];
  if (value === undefined || value === null) return { kind: "empty" };

  switch (field.type) {
    case "single_choice":
      return { kind: "text", text: optionLabel(field.config.options, value) };
    case "multiple_choice": {
      const ids = Array.isArray(value) ? value : [value];
      if (ids.length === 0) return { kind: "empty" };
      return { kind: "text", text: ids.map((id) => optionLabel(field.config.options, id)).join(", ") };
    }
    case "yes_no":
      return { kind: "text", text: value === true ? "Sí" : "No" };
    case "photo":
      return { kind: "photos", files: value as FileRef[] };
    case "signature":
      return { kind: "signature", file: value as FileRef };
    case "gps":
      return { kind: "gps", value: value as GpsAnswer };
    default:
      return { kind: "text", text: String(value) };
  }
}

import type { Field, FileRef } from "@/lib/form-schema";
import { neutralizeFormula } from "./cell-safety";

export type ExportCell = string | number | null; // null = celda vacía

function isFileRef(value: unknown): value is FileRef {
  return typeof value === "object" && value !== null && typeof (value as FileRef).key === "string";
}

function text(value: string): string {
  return neutralizeFormula(value);
}

/**
 * Sin E/S. `value` es answers[field.id]. Devuelve null si no hay valor.
 *
 * Cubre: RF-OUT-06, RF-OUT-12
 */
export function formatExportCell(
  field: Field,
  value: unknown,
  buildFileLink: (file: FileRef) => string,
): ExportCell {
  if (value === undefined || value === null) return null;

  switch (field.type) {
    case "section":
      return null;
    case "number":
      return typeof value === "number" ? value : text(String(value));
    case "text":
    case "date":
    case "datetime":
    case "time":
      return text(String(value));
    case "single_choice": {
      const id = String(value);
      return text(field.config.options.find((o) => o.id === id)?.label ?? id);
    }
    case "multiple_choice": {
      if (!Array.isArray(value) || value.length === 0) return null;
      const labels = value.map((v) => {
        const id = String(v);
        return field.config.options.find((o) => o.id === id)?.label ?? id;
      });
      return text(labels.join(", "));
    }
    case "yes_no":
      return typeof value === "boolean" ? (value ? "Sí" : "No") : null;
    case "photo": {
      if (!Array.isArray(value)) return null;
      const links = value.filter(isFileRef).map((f) => buildFileLink(f));
      return links.length === 0 ? null : text(links.join("\n"));
    }
    case "signature":
      return isFileRef(value) ? text(buildFileLink(value)) : null;
    case "gps": {
      if (typeof value !== "object") return null;
      const { lat, lng } = value as { lat?: unknown; lng?: unknown };
      if (typeof lat !== "number" || typeof lng !== "number") return null;
      return `${lat}, ${lng}`;
    }
  }
}

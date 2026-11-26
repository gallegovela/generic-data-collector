import { FormVersionSchema, type Field, type FileRef } from "@/lib/form-schema";
import { neutralizeFormula } from "./cell-safety";
import { formatExportCell, type ExportCell } from "./format-cell";

export type ExportSourceRow = {
  capturedAt: Date;
  syncedAt: Date;
  submittedByName: string | null;
  formVersionNumber: number | null;
  formVersionSnapshot: unknown;
  answers: Record<string, unknown>;
};

export type ExportTable = { headers: string[]; rows: ExportCell[][] };

const FIXED_HEADERS = ["Fecha de captura", "Fecha de sincronización", "Enviado por", "Versión"];

/**
 * `rows` llega ordenado como el listado (capturedAt desc). Un campo por `id`
 * en la unión de las versiones; cada fila se formatea con su propia versión.
 *
 * Cubre: RF-OUT-06, CA-OUT-02, CA-OUT-04, CA-OUT-05
 */
export function buildExportTable(
  rows: ExportSourceRow[],
  options: { buildFileLink: (file: FileRef) => string },
): ExportTable {
  const parsed = rows.map((row) => {
    const result = FormVersionSchema.safeParse(row.formVersionSnapshot);
    const fields: Map<string, Field> = new Map();
    if (result.success) {
      for (const f of result.data.fields) if (f.type !== "section") fields.set(f.id, f);
    }
    return fields;
  });

  const labels = new Map<string, string>(); // orden de aparición + etiqueta más reciente
  for (const fields of parsed) {
    for (const [id, field] of fields) if (!labels.has(id)) labels.set(id, field.label);
  }
  const fieldIds = [...labels.keys()];

  const headers = [...FIXED_HEADERS, ...fieldIds.map((id) => neutralizeFormula(labels.get(id) ?? id))];

  const tableRows = rows.map((row, i): ExportCell[] => {
    const fields = parsed[i];
    return [
      row.capturedAt.toISOString(),
      row.syncedAt.toISOString(),
      row.submittedByName === null ? null : neutralizeFormula(row.submittedByName),
      row.formVersionNumber,
      ...fieldIds.map((id) => {
        const field = fields.get(id);
        return field ? formatExportCell(field, row.answers[id], options.buildFileLink) : null;
      }),
    ];
  });

  return { headers, rows: tableRows };
}

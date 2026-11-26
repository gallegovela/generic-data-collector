import type { ExportFormat } from "./export-query.schema";

const FILTER_KEYS = ["dateFrom", "dateTo", "submittedBy", "fieldId", "fieldValue", "q"] as const;

/** URL de descarga con los filtros activos (sin `page`). Cubre: RF-OUT-05 */
export function buildExportHref(
  formId: string,
  query: Record<string, string | undefined>,
  format: ExportFormat,
): string {
  const params = new URLSearchParams({ format });
  for (const key of FILTER_KEYS) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  return `/api/forms/${encodeURIComponent(formId)}/submissions/export?${params.toString()}`;
}

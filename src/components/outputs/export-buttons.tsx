import { buildExportHref } from "@/lib/outputs/export-href";

const linkClass =
  "inline-flex h-8 items-center rounded-lg border border-input px-2.5 text-sm hover:bg-muted";

/** Enlaces de descarga con los filtros activos. Cubre: RF-OUT-05 */
export function ExportButtons({
  formId,
  query,
}: {
  formId: string;
  query: Record<string, string | undefined>;
}) {
  return (
    <div className="flex gap-2" data-testid="export-buttons">
      <a href={buildExportHref(formId, query, "xlsx")} className={linkClass}>
        Exportar a Excel
      </a>
      <a href={buildExportHref(formId, query, "csv")} className={linkClass}>
        Exportar a CSV
      </a>
    </div>
  );
}

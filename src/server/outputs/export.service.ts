import { NotFoundError, ValidationError } from "@/lib/errors";
import { buildExportTable, type ExportSourceRow } from "@/lib/outputs/export-table";
import { serializeCsv } from "@/lib/outputs/csv";
import { EXPORT_MAX_ROWS, type SubmissionExportQuery } from "@/lib/outputs/export-query.schema";
import { buildFileExportLink } from "@/lib/outputs/file-link";
import {
  countSubmissionsOfForm,
  findFilterableFields,
  listSubmissionsForExport,
} from "@/server/submissions/submission.repository";
import { toListFilters } from "@/server/submissions/submission.service";
import { serializeXlsx } from "./xlsx";

export type SubmissionExport = {
  filename: string;
  contentType: string;
  body: Buffer;
  rowCount: number;
};

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV_TYPE = "text/csv; charset=utf-8";

function slug(title: string): string {
  const s = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "respuestas";
}

function yyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * No registra contenido de respuestas en logs.
 *
 * Cubre: RF-OUT-05, RF-OUT-11, CA-OUT-06
 */
export async function exportSubmissions(
  organizationId: string,
  formId: string,
  query: SubmissionExportQuery,
  baseUrl: string,
): Promise<SubmissionExport> {
  if ((await countSubmissionsOfForm(organizationId, formId)) === 0) {
    throw new NotFoundError("No se ha encontrado el formulario.");
  }

  const { format, ...input } = query;
  const filterableFields = await findFilterableFields(organizationId, formId);
  const filters = toListFilters(input, filterableFields);

  const rows = await listSubmissionsForExport(organizationId, formId, filters, EXPORT_MAX_ROWS + 1);
  if (rows.length > EXPORT_MAX_ROWS) {
    throw new ValidationError(
      "Hay demasiadas respuestas para exportar de una vez (máximo 10 000). Acota con filtros.",
    );
  }

  const source: ExportSourceRow[] = rows.map((r) => ({
    capturedAt: r.capturedAt,
    syncedAt: r.syncedAt,
    submittedByName: r.submittedByName,
    formVersionNumber: r.formVersionNumber,
    formVersionSnapshot: r.formVersionSnapshot,
    answers:
      typeof r.answers === "object" && r.answers !== null && !Array.isArray(r.answers)
        ? (r.answers as Record<string, unknown>)
        : {},
  }));
  const table = buildExportTable(source, { buildFileLink: (f) => buildFileExportLink(baseUrl, f) });

  const body = format === "xlsx" ? await serializeXlsx(table) : Buffer.from(serializeCsv(table), "utf8");
  const title = rows.length > 0 ? rows[0].formTitle : "respuestas";

  return {
    filename: `${slug(title)}-respuestas-${yyyymmdd(new Date())}.${format}`,
    contentType: format === "xlsx" ? XLSX_TYPE : CSV_TYPE,
    body,
    rowCount: rows.length,
  };
}

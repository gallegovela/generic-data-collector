import type { ExportCell } from "./format-cell";
import type { ExportTable } from "./export-table";

function csvCell(cell: ExportCell | string): string {
  if (cell === null) return "";
  if (typeof cell === "number") return String(cell);
  return /[;"\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** BOM + líneas unidas por "\r\n"; separador ";". Cubre: RNF-OUT-04, CA-OUT-05 */
export function serializeCsv(table: ExportTable): string {
  const lines = [table.headers, ...table.rows].map((row) => row.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}`;
}

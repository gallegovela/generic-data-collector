import ExcelJS from "exceljs";
import type { ExportTable } from "@/lib/outputs/export-table";

/**
 * Hoja "Respuestas"; fila 1 = cabeceras en negrita y congelada. Las cadenas se
 * escriben siempre como texto, nunca como `{ formula }`.
 *
 * Cubre: RF-OUT-05, CA-OUT-02, CA-OUT-05
 */
export async function serializeXlsx(table: ExportTable): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Respuestas", { views: [{ state: "frozen", ySplit: 1 }] });
  const header = sheet.addRow(table.headers);
  header.font = { bold: true };
  for (const row of table.rows) sheet.addRow(row);
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { serializeXlsx } from "./xlsx";

async function load(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = wb.getWorksheet("Respuestas");
  if (!sheet) throw new Error("falta la hoja");
  return sheet;
}

describe("serializeXlsx", () => {
  // Cubre: RF-OUT-05, CA-OUT-02
  it("CA-OUT-02: 1 fila de cabecera y 3 de datos; un number es numérico", async () => {
    const sheet = await load(
      await serializeXlsx({
        headers: ["Nombre", "Cantidad"],
        rows: [["a", 1], ["b", 2.5], ["c", null]],
      }),
    );
    expect(sheet.rowCount).toBe(4);
    expect(sheet.getRow(1).values).toEqual([undefined, "Nombre", "Cantidad"]);
    expect(sheet.getRow(1).font?.bold).toBe(true);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    const cell = sheet.getCell("B3");
    expect(cell.type).toBe(ExcelJS.ValueType.Number);
    expect(cell.value).toBe(2.5);
  });

  // Cubre: CA-OUT-05
  it("CA-OUT-05: '=1+1 queda como texto, no como fórmula", async () => {
    const sheet = await load(await serializeXlsx({ headers: ["H"], rows: [["'=1+1"]] }));
    const cell = sheet.getCell("A2");
    expect(cell.type).toBe(ExcelJS.ValueType.String);
    expect(cell.value).toBe("'=1+1");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildDailyReportFormVersion,
  buildDailyReportFormVersionV2,
} from "../../../prisma/fixtures/submissions-dashboard.fixtures";
import { buildExportTable, type ExportSourceRow } from "./export-table";

const options = { buildFileLink: (f: { key: string }) => `L/${f.key}` };
const date = new Date("2026-01-02T03:04:05.000Z");

function row(over: Partial<ExportSourceRow>): ExportSourceRow {
  return {
    capturedAt: date,
    syncedAt: date,
    submittedByName: "Ana",
    formVersionNumber: 1,
    formVersionSnapshot: buildDailyReportFormVersion(),
    answers: { site: "Obra 1", has_incidents: true },
    ...over,
  };
}

describe("buildExportTable", () => {
  // Cubre: CA-OUT-04, RF-OUT-06
  it("CA-OUT-04: una columna por campo, vacía en las filas de v1 y etiqueta de la más reciente", () => {
    const v2 = buildDailyReportFormVersionV2();
    v2.fields = v2.fields.map((f) => (f.id === "site" ? { ...f, label: "Obra (nuevo)" } : f));
    const table = buildExportTable(
      [
        row({ formVersionSnapshot: v2, formVersionNumber: 2, answers: { site: "B", weather: "Sol" } }),
        row({ answers: { site: "A", has_incidents: false } }),
      ],
      options,
    );

    expect(table.headers.slice(0, 4)).toEqual(["Fecha de captura", "Fecha de sincronización", "Enviado por", "Versión"]);
    const fieldHeaders = table.headers.slice(4);
    expect(fieldHeaders.filter((h) => h === "Obra (nuevo)")).toHaveLength(1);
    expect(fieldHeaders).toContain("Tiempo");
    expect(fieldHeaders).not.toContain("Datos de la obra"); // sección fuera
    const weatherCol = table.headers.indexOf("Tiempo");
    const siteCol = table.headers.indexOf("Obra (nuevo)");
    expect(table.rows[0][weatherCol]).toBe("Sol");
    expect(table.rows[1][weatherCol]).toBeNull();
    expect(table.rows[1][siteCol]).toBe("A");
    expect(table.rows[0][3]).toBe(2);
    expect(table.rows[1][3]).toBe(1);
  });

  // Cubre: CA-OUT-04
  it("CA-OUT-04: un campo retirado en la versión más reciente se conserva", () => {
    const v2 = buildDailyReportFormVersionV2();
    v2.fields = v2.fields.filter((f) => f.id !== "notes");
    const table = buildExportTable(
      [row({ formVersionSnapshot: v2 }), row({ answers: { site: "A", notes: "viejo" } })],
      options,
    );
    const col = table.headers.indexOf("Observaciones");
    expect(col).toBeGreaterThan(3);
    expect(table.rows[0][col]).toBeNull();
    expect(table.rows[1][col]).toBe("viejo");
  });

  // Cubre: CA-OUT-02
  it("CA-OUT-02: fechas ISO, enviado por y sin filas solo las 4 cabeceras fijas", () => {
    const table = buildExportTable([row({})], options);
    expect(table.rows[0].slice(0, 3)).toEqual([date.toISOString(), date.toISOString(), "Ana"]);
    expect(buildExportTable([], options)).toEqual({
      headers: ["Fecha de captura", "Fecha de sincronización", "Enviado por", "Versión"],
      rows: [],
    });
  });

  // Cubre: CA-OUT-02
  it("CA-OUT-02: un snapshot inválido no rompe y solo aporta metadatos", () => {
    const table = buildExportTable([row({ formVersionSnapshot: { roto: true } })], options);
    expect(table.headers).toHaveLength(4);
    expect(table.rows[0]).toHaveLength(4);
  });

  // Cubre: CA-OUT-05
  it("CA-OUT-05: neutraliza fórmulas en 'Enviado por' y en las celdas", () => {
    const table = buildExportTable([row({ submittedByName: "=cmd", answers: { site: "=1+1" } })], options);
    expect(table.rows[0][2]).toBe("'=cmd");
    expect(table.rows[0][table.headers.indexOf("Obra")]).toBe("'=1+1");
  });
});

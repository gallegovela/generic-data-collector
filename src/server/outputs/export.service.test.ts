import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { SubmissionExportQuery } from "@/lib/outputs/export-query.schema";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import { createSubmissionFixture } from "@/server/submissions/submission.repository";
import { listSubmissions } from "@/server/submissions/submission.service";
import { buildDailyReportFormVersion } from "../../../prisma/fixtures/submissions-dashboard.fixtures";
import { exportSubmissions } from "./export.service";

// Máximo reducido para poder probar el límite con pocas filas.
vi.mock("@/lib/outputs/export-query.schema", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/outputs/export-query.schema")>()),
  EXPORT_MAX_ROWS: 5,
}));

// Requiere PostgreSQL accesible vía DATABASE_URL (ver specs/outputs/test-plan.md).

const BASE = "https://app.test";

function query(over: Partial<SubmissionExportQuery> = {}): SubmissionExportQuery {
  return { format: "csv", ...over };
}

describe("export.service", () => {
  const orgIds: string[] = [];
  let orgA: { id: string };
  let orgB: { id: string };

  async function add(formId: string, n: number, over: { title?: string; by?: string; answers?: Record<string, unknown> } = {}) {
    return createSubmissionFixture(orgA.id, {
      formId,
      formTitle: over.title ?? "Parte diario de obra",
      clientId: `${formId}-${n}`,
      formVersionSnapshot: buildDailyReportFormVersion(),
      answers: over.answers ?? { site: `Obra ${n}`, has_incidents: n % 2 === 0, photos: [{ key: "org/foto 1.jpg" }] },
      submittedByName: over.by ?? "Ana",
      capturedAt: new Date(Date.now() - n * 60_000),
    });
  }

  beforeAll(async () => {
    orgA = await createOrganization({ name: "Org A (export.service test)" });
    orgB = await createOrganization({ name: "Org B (export.service test)" });
    orgIds.push(orgA.id, orgB.id);
    // 5 respuestas: 3 de "Luis" (n = 0, 2, 4) y 2 de "Ana".
    for (let i = 0; i < 5; i++) await add("main-form", i, { by: i % 2 === 0 ? "Luis" : "Ana" });
  });

  afterAll(async () => {
    await prisma.submission.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  });

  // Cubre: CA-OUT-02, RF-OUT-05
  it("CA-OUT-02: xlsx con 1 cabecera y las 3 filas filtradas", async () => {
    const result = await exportSubmissions(orgA.id, "main-form", query({ format: "xlsx", submittedBy: "luis" }), BASE);
    expect(result.rowCount).toBe(3);
    expect(result.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(result.filename).toMatch(/^parte-diario-de-obra-respuestas-\d{8}\.xlsx$/);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.body as unknown as ArrayBuffer);
    expect(wb.getWorksheet("Respuestas")?.rowCount).toBe(4);
  });

  // Cubre: RF-OUT-11
  it("RF-OUT-11: el número de filas coincide con el total del listado con los mismos filtros", async () => {
    const filters = [
      { submittedBy: "luis" },
      { q: "Obra 3" },
      { dateFrom: "2000-01-01", dateTo: "2999-12-31" },
      { fieldId: "has_incidents", fieldValue: "true" },
      { submittedBy: "ana", fieldId: "has_incidents", fieldValue: "false" },
    ];
    for (const f of filters) {
      const listed = await listSubmissions(orgA.id, "main-form", { page: 1, ...f });
      const exported = await exportSubmissions(orgA.id, "main-form", query(f), BASE);
      expect(exported.rowCount, JSON.stringify(f)).toBe(listed.total);
    }
  });

  // Cubre: RF-OUT-11, RNF-OUT-03
  it("RF-OUT-11: más del máximo de filas lanza ValidationError", async () => {
    for (let i = 0; i < 5; i++) await add("big-form", i);
    expect((await exportSubmissions(orgA.id, "big-form", query(), BASE)).rowCount).toBe(5);
    await add("big-form", 5);
    await expect(exportSubmissions(orgA.id, "big-form", query(), BASE)).rejects.toBeInstanceOf(ValidationError);
    // acotando con filtros sí se puede
    await expect(exportSubmissions(orgA.id, "big-form", query({ q: "Obra 4" }), BASE)).resolves.toMatchObject({
      rowCount: 1,
    });
  });

  // Cubre: CA-OUT-06, RF-OUT-11
  it("CA-OUT-06: la organización B no puede exportar el formulario de A y un formulario inexistente da lo mismo", async () => {
    const error = await exportSubmissions(orgB.id, "main-form", query(), BASE).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    const missing = await exportSubmissions(orgA.id, "no-existe", query(), BASE).catch((e: unknown) => e);
    expect(missing).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe((missing as Error).message);
  });

  // Cubre: RF-OUT-06
  it("RF-OUT-06: el baseUrl recibido aparece en los enlaces de archivos", async () => {
    const result = await exportSubmissions(orgA.id, "main-form", query({ q: "Obra 1" }), "https://publico.test");
    const text = result.body.toString("utf8");
    expect(text).toContain("https://publico.test/api/files/org%2Ffoto%201.jpg");
  });

  // Cubre: RF-OUT-05, CA-OUT-05
  it("CA-OUT-05: el filename queda solo con [a-z0-9-] aunque el título lleve saltos de línea, comillas y acentos", async () => {
    await add("title-form", 0, { title: 'Parte\n"Obra" ñ é' });
    const result = await exportSubmissions(orgA.id, "title-form", query(), BASE);
    expect(result.filename).toMatch(/^[a-z0-9-]+\.csv$/);
    expect(result.filename).toMatch(/^parte-obra-n-e-respuestas-\d{8}\.csv$/);
  });
});

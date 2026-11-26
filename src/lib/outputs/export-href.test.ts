import { describe, expect, it } from "vitest";
import { submissionExportQuerySchema } from "./export-query.schema";
import { buildExportHref } from "./export-href";

describe("buildExportHref", () => {
  // Cubre: RF-OUT-05
  it("RF-OUT-05: incluye el formato y solo los filtros no vacíos, sin page", () => {
    const href = buildExportHref("f1", { dateFrom: "2026-01-01", q: "", page: "3" }, "csv");
    expect(href).toBe("/api/forms/f1/submissions/export?format=csv&dateFrom=2026-01-01");
  });
});

describe("submissionExportQuerySchema", () => {
  // Cubre: RF-OUT-05
  it("RF-OUT-05: exige un formato conocido", () => {
    expect(submissionExportQuerySchema.safeParse({}).success).toBe(false);
    expect(submissionExportQuerySchema.safeParse({ format: "pdf" }).success).toBe(false);
    expect(submissionExportQuerySchema.safeParse({ format: "xlsx" }).success).toBe(true);
  });
});

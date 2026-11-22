import { describe, expect, it } from "vitest";
import { SUBMISSIONS_PAGE_SIZE, submissionFiltersSchema } from "./submission-filters.schema";

// Cubre: RF-SUB-05, RF-SUB-06, RF-SUB-07
describe("submissionFiltersSchema", () => {
  it("aplica página 1 por defecto y el tamaño de página es 20", () => {
    expect(submissionFiltersSchema.parse({}).page).toBe(1);
    expect(SUBMISSIONS_PAGE_SIZE).toBe(20);
  });

  it("convierte la página de texto a número", () => {
    expect(submissionFiltersSchema.parse({ page: "3" }).page).toBe(3);
  });

  it("rechaza fechas inválidas y páginas no positivas", () => {
    expect(submissionFiltersSchema.safeParse({ dateFrom: "ayer" }).success).toBe(false);
    expect(submissionFiltersSchema.safeParse({ page: "0" }).success).toBe(false);
  });

  it("recorta espacios y rechaza cadenas vacías", () => {
    expect(submissionFiltersSchema.parse({ q: "  grúa " }).q).toBe("grúa");
    expect(submissionFiltersSchema.safeParse({ q: "   " }).success).toBe(false);
  });
});

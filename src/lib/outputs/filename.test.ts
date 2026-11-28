import { describe, expect, it } from "vitest";
import { buildPdfFilename, slugify } from "./filename";

describe("filename", () => {
  // Cubre: RF-OUT-04
  it("RF-OUT-04: slugify deja solo [a-z0-9-] y usa 'respuestas' si queda vacío", () => {
    expect(slugify('Parte\n"Obra" ñ é')).toBe("parte-obra-n-e");
    expect(slugify("!!!")).toBe("respuestas");
  });

  it("RF-OUT-04: buildPdfFilename usa título, fecha UTC y sufijo del id", () => {
    expect(buildPdfFilename("Parte diario", new Date("2026-11-26T23:30:00Z"), "clxABCDEFGH12345")).toBe(
      "parte-diario-20261126-fgh12345.pdf",
    );
  });
});

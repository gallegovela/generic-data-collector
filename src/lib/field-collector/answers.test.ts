import { describe, expect, it } from "vitest";
import { dailyConstructionReportForm, validateSubmission } from "@/lib/form-schema";
import { collectFileKeys, emptyAnswers, hasAnyAnswer } from "./answers";

describe("answers", () => {
  it("emptyAnswers devuelve un objeto vacío nuevo", () => {
    expect(emptyAnswers()).toEqual({});
    expect(emptyAnswers()).not.toBe(emptyAnswers());
  });

  it("hasAnyAnswer ignora vacíos y detecta valores", () => {
    expect(hasAnyAnswer({})).toBe(false);
    expect(hasAnyAnswer({ a: "  ", b: [] })).toBe(false);
    expect(hasAnyAnswer({ a: false })).toBe(true);
    expect(hasAnyAnswer({ a: 0 })).toBe(true);
    expect(hasAnyAnswer({ a: "x" })).toBe(true);
  });

  // Cubre: CA-COL-03
  it("CA-COL-03: el campo condicional oculto no se exige ni se guarda", () => {
    const base = {
      date: "2026-11-26",
      site: "Obra 1",
      work_done: "Cimentación",
      workers: 4,
      foreman_signature: { key: "org/o/signature/a.png" },
    };
    const hidden = validateSubmission(dailyConstructionReportForm, { ...base, incident: false });
    expect(hidden.success).toBe(true);

    const shown = validateSubmission(dailyConstructionReportForm, { ...base, incident: true });
    expect(shown.success).toBe(false);

    const dropped = validateSubmission(dailyConstructionReportForm, {
      ...base,
      incident: false,
      incident_detail: "queda oculto",
    });
    expect(dropped.success && "incident_detail" in dropped.data).toBe(false);
  });

  it("collectFileKeys recoge fotos y firma visibles", () => {
    const keys = collectFileKeys(dailyConstructionReportForm, {
      photos: [{ key: "org/o/photo/1.jpg" }, { key: "org/o/photo/2.jpg" }],
      foreman_signature: { key: "org/o/signature/3.png" },
      date: "2026-11-26",
    });
    expect(keys).toEqual(["org/o/photo/1.jpg", "org/o/photo/2.jpg", "org/o/signature/3.png"]);
  });

  it("collectFileKeys ignora campos sin respuesta y valores mal formados", () => {
    expect(collectFileKeys(dailyConstructionReportForm, {})).toEqual([]);
    expect(collectFileKeys(dailyConstructionReportForm, { photos: [null, "x", {}] })).toEqual([]);
  });
});

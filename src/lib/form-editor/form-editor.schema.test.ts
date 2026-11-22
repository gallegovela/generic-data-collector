import { describe, expect, it } from "vitest";
import {
  DraftFormSchema,
  createFormSchema,
  duplicateFormSchema,
  mapDraftIssuesToFields,
} from "./form-editor.schema";

describe("form-editor.schema", () => {
  // Cubre: CA-EDT-04
  it("createFormSchema exige nombre no vacío y lo recorta", () => {
    expect(createFormSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(createFormSchema.parse({ name: " Parte " }).name).toBe("Parte");
  });

  // Cubre: CA-EDT-05
  it("duplicateFormSchema exige sourceFormId y nombre", () => {
    expect(duplicateFormSchema.safeParse({ sourceFormId: "", name: "x" }).success).toBe(false);
    expect(duplicateFormSchema.safeParse({ sourceFormId: "a", name: "x" }).success).toBe(true);
  });

  // Cubre: CA-EDT-07, RF-EDT-10
  it("un single_choice sin opciones no es válido y se señala el campo", () => {
    const draft = {
      title: "T",
      fields: [
        { id: "ok", type: "text", label: "Ok", required: false, config: {} },
        {
          id: "sel",
          type: "single_choice",
          label: "Sel",
          required: false,
          config: { options: [], display: "radio" },
        },
      ],
    };
    const result = DraftFormSchema.safeParse(draft);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = mapDraftIssuesToFields(draft as never, result.error);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.every((i) => i.fieldId === "sel")).toBe(true);
    }
  });

  // Cubre: RF-EDT-10
  it("un título vacío no es válido y no genera issues de campo", () => {
    const draft = { title: "", fields: [] };
    const result = DraftFormSchema.safeParse(draft);
    expect(result.success).toBe(false);
    if (!result.success) expect(mapDraftIssuesToFields(draft, result.error)).toEqual([]);
  });
});

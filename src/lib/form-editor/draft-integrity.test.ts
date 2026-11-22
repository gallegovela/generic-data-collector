import { describe, expect, it } from "vitest";
import { DraftFormSchema } from "./form-editor.schema";
import type { Field } from "@/lib/form-schema";

const text = (id: string, extra: Partial<Field> = {}): Field =>
  ({ id, type: "text", label: id, required: false, config: {}, ...extra }) as Field;

describe("checkDraftIntegrity", () => {
  // Cubre: RF-EDT-07
  it("acepta un borrador vacío", () => {
    expect(DraftFormSchema.safeParse({ title: "X", fields: [] }).success).toBe(true);
  });

  // Cubre: RF-EDT-07
  it("rechaza ids duplicados", () => {
    const r = DraftFormSchema.safeParse({ title: "X", fields: [text("a"), text("a")] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["fields", 1, "id"]);
  });

  // Cubre: RF-EDT-07
  it("rechaza visibleIf que referencia un campo inexistente, posterior o el propio", () => {
    for (const ref of ["nope", "b", "a"]) {
      const r = DraftFormSchema.safeParse({
        title: "X",
        fields: [text("a", { visibleIf: { fieldId: ref, operator: "isAnswered" } }), text("b")],
      });
      expect(r.success).toBe(false);
    }
  });

  // Cubre: CA-EDT-12
  it("acepta visibleIf que referencia un campo anterior", () => {
    const r = DraftFormSchema.safeParse({
      title: "X",
      fields: [text("a"), text("b", { visibleIf: { fieldId: "a", operator: "equals", value: "x" } })],
    });
    expect(r.success).toBe(true);
  });
});

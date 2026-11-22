import { describe, expect, it } from "vitest";
import { FormVersionSchema } from "./form-version.schema";
import { getVisibleFields, isFieldVisible, validateSubmission } from "./submission";

const form = FormVersionSchema.parse({
  schemaVersion: 1,
  title: "T",
  fields: [
    { id: "sec", type: "section", label: "Sección", required: false, config: {} },
    { id: "has_pet", type: "yes_no", label: "Mascota", required: true, config: {} },
    {
      id: "pet_name",
      type: "text",
      label: "Nombre de la mascota",
      required: true,
      visibleIf: { fieldId: "has_pet", operator: "equals", value: true },
      config: {},
    },
    { id: "qty", type: "number", label: "Cantidad", required: false, config: { max: 10 } },
  ],
});

describe("visibility", () => {
  it("RF-FSC-06 — getVisibleFields filters by visibleIf", () => {
    expect(getVisibleFields(form, { has_pet: false }).map((f) => f.id)).toEqual(["sec", "has_pet", "qty"]);
    expect(getVisibleFields(form, { has_pet: true }).map((f) => f.id)).toContain("pet_name");
    expect(isFieldVisible(form.fields[0]!, {})).toBe(true);
  });
});

describe("validateSubmission", () => {
  it("CA-FSC-02 — a required hidden field does not block the submission", () => {
    const r = validateSubmission(form, { has_pet: false });
    expect(r).toEqual({ success: true, data: { has_pet: false } });
  });

  it("RF-FSC-06 — ignores answers of hidden fields", () => {
    const r = validateSubmission(form, { has_pet: false, pet_name: 123 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).not.toHaveProperty("pet_name");
  });

  it("RF-FSC-06 — a required visible field without answer fails", () => {
    const r = validateSubmission(form, { has_pet: true });
    expect(r).toEqual({
      success: false,
      errors: [{ fieldId: "pet_name", message: '"Nombre de la mascota" es obligatorio.' }],
    });
  });

  it("CA-FSC-03 — number above max fails on that field", () => {
    const r = validateSubmission(form, { has_pet: false, qty: 11 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0]?.fieldId).toBe("qty");
    }
  });

  it("RF-FSC-06 — optional empty field is skipped; valid values are kept", () => {
    const r = validateSubmission(form, { has_pet: true, pet_name: "Rex", qty: "" });
    expect(r).toEqual({ success: true, data: { has_pet: true, pet_name: "Rex" } });
  });
});

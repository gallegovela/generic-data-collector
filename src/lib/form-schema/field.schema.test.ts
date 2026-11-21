import { describe, expect, it } from "vitest";
import { FIELD_TYPES, FieldSchema, GpsAnswerSchema, OptionSchema } from "./field.schema";
import { buildFieldAnswerSchema } from "./answer.schema";

const choice = (label: string) =>
  FieldSchema.parse({
    id: "color",
    type: "single_choice",
    label: "Color",
    required: true,
    config: { display: "radio", options: [{ id: "opt_red", label }] },
  });

describe("FieldSchema", () => {
  it("RF-FSC-03 — accepts every field type", () => {
    const configs: Record<string, unknown> = {
      single_choice: { display: "radio", options: [{ id: "a", label: "A" }] },
      multiple_choice: { options: [{ id: "a", label: "A" }] },
    };
    for (const type of FIELD_TYPES) {
      const result = FieldSchema.safeParse({
        id: "f",
        type,
        label: "F",
        required: false,
        config: configs[type] ?? {},
      });
      expect(result.success, type).toBe(true);
    }
  });

  it("RF-FSC-01 — rejects unknown types and missing config", () => {
    expect(FieldSchema.safeParse({ id: "f", type: "nope", label: "F", required: false, config: {} }).success).toBe(false);
    expect(FieldSchema.safeParse({ id: "f", type: "text", label: "F", required: false }).success).toBe(false);
  });

  it("RF-FSC-03 — a required section is rejected", () => {
    expect(FieldSchema.safeParse({ id: "s", type: "section", label: "S", required: true, config: {} }).success).toBe(false);
  });

  it("RF-FSC-04 — requires a non-empty stable id", () => {
    expect(FieldSchema.safeParse({ id: "", type: "yes_no", label: "F", required: false, config: {} }).success).toBe(false);
  });

  it("RF-FSC-10 — options need an id", () => {
    expect(OptionSchema.safeParse({ label: "A" }).success).toBe(false);
    expect(OptionSchema.safeParse({ id: "a", label: "A" }).success).toBe(true);
  });

  it("CA-FSC-08 — renaming an option label keeps an old answer valid", () => {
    const before = choice("Rojo");
    const after = choice("Rojo oscuro");
    expect(buildFieldAnswerSchema(before).safeParse("opt_red").success).toBe(true);
    expect(buildFieldAnswerSchema(after).safeParse("opt_red").success).toBe(true);
    expect(buildFieldAnswerSchema(after).safeParse("Rojo").success).toBe(false);
  });
});

describe("GpsAnswerSchema", () => {
  const ok = { lat: 40, lng: -3, accuracy: 5, capturedAt: "2026-01-01T10:00:00Z" };
  it("RF-FSC-03 — validates ranges", () => {
    expect(GpsAnswerSchema.safeParse(ok).success).toBe(true);
    expect(GpsAnswerSchema.safeParse({ ...ok, lat: 91 }).success).toBe(false);
    expect(GpsAnswerSchema.safeParse({ ...ok, lng: -181 }).success).toBe(false);
    expect(GpsAnswerSchema.safeParse({ ...ok, accuracy: -1 }).success).toBe(false);
    expect(GpsAnswerSchema.safeParse({ ...ok, capturedAt: "ayer" }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { buildFieldAnswerSchema } from "./answer.schema";
import { FieldSchema, type Field } from "./field.schema";

function field(type: string, config: unknown = {}): Field {
  return FieldSchema.parse({ id: "f", type, label: "F", required: false, config });
}
const ok = (f: Field, v: unknown) => buildFieldAnswerSchema(f).safeParse(v).success;
const options = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
];

describe("buildFieldAnswerSchema", () => {
  it("RF-FSC-03 — text length limits", () => {
    const f = field("text", { minLength: 2, maxLength: 3 });
    expect(ok(f, "ab")).toBe(true);
    expect(ok(f, "a")).toBe(false);
    expect(ok(f, "abcd")).toBe(false);
    expect(ok(field("text"), "anything")).toBe(true);
  });

  it("RF-FSC-03 — number min/max", () => {
    const f = field("number", { min: 1, max: 10 });
    expect(ok(f, 5)).toBe(true);
    expect(ok(f, 0)).toBe(false);
    expect(ok(f, 11)).toBe(false);
    expect(ok(f, "5")).toBe(false);
    expect(ok(field("number"), 99)).toBe(true);
  });

  it("RF-FSC-03 — date min/max", () => {
    const f = field("date", { min: "2026-01-10", max: "2026-01-20" });
    expect(ok(f, "2026-01-15")).toBe(true);
    expect(ok(f, "2026-01-10")).toBe(true);
    expect(ok(f, "2026-01-09")).toBe(false);
    expect(ok(f, "2026-01-21")).toBe(false);
    expect(ok(f, "no-date")).toBe(false);
    expect(ok(field("date"), "2026-05-05")).toBe(true);
  });

  it("RF-FSC-03 — datetime min/max", () => {
    const f = field("datetime", { min: "2026-01-10T08:00:00Z", max: "2026-01-10T18:00:00Z" });
    expect(ok(f, "2026-01-10T12:00:00Z")).toBe(true);
    expect(ok(f, "2026-01-10T07:00:00Z")).toBe(false);
    expect(ok(f, "2026-01-10T19:00:00Z")).toBe(false);
    const r = buildFieldAnswerSchema(f).safeParse("2026-01-10T07:00:00Z");
    expect(!r.success && r.error.issues[0]?.message).toContain("La fecha y hora debe ser posterior");
  });

  it("RF-FSC-03 — time", () => {
    const f = field("time");
    expect(ok(f, "09:30")).toBe(true);
    expect(ok(f, "24:00")).toBe(false);
  });

  it("RF-FSC-03 — single and multiple choice", () => {
    const s = field("single_choice", { options, display: "radio" });
    expect(ok(s, "a")).toBe(true);
    expect(ok(s, "z")).toBe(false);
    const m = field("multiple_choice", { options, minSelected: 1, maxSelected: 1 });
    expect(ok(m, ["a"])).toBe(true);
    expect(ok(m, [])).toBe(false);
    expect(ok(m, ["a", "b"])).toBe(false);
    expect(ok(m, ["z"])).toBe(false);
    expect(ok(field("multiple_choice", { options }), ["a", "b"])).toBe(true);
  });

  it("RF-FSC-03 — yes_no, photo, signature, gps", () => {
    expect(ok(field("yes_no"), false)).toBe(true);
    expect(ok(field("yes_no"), "si")).toBe(false);
    const p = field("photo", { maxPhotos: 1 });
    expect(ok(p, [{ key: "a" }])).toBe(true);
    expect(ok(p, [{ key: "a" }, { key: "b" }])).toBe(false);
    expect(ok(field("photo"), [{ key: "a" }, { key: "b" }])).toBe(true);
    expect(ok(field("signature"), { key: "sig" })).toBe(true);
    expect(ok(field("signature"), {})).toBe(false);
    expect(ok(field("gps"), { lat: 1, lng: 1, accuracy: 1, capturedAt: "2026-01-01T00:00:00Z" })).toBe(true);
  });

  it("RF-FSC-03 — section has no answer", () => {
    const s = FieldSchema.parse({ id: "s", type: "section", label: "S", required: false, config: {} });
    expect(() => buildFieldAnswerSchema(s)).toThrow("section no tiene respuesta");
  });
});

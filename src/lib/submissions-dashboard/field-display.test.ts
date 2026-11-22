import { describe, expect, it } from "vitest";
import type { Field } from "@/lib/form-schema";
import { buildFieldDisplayValue } from "./field-display";

const f = (x: Record<string, unknown>) => ({ required: false, config: {}, ...x }) as unknown as Field;

// Cubre: RF-SUB-08 (representación por tipo de campo, PP-SUB-08)
describe("buildFieldDisplayValue", () => {
  it("section", () => {
    expect(buildFieldDisplayValue(f({ id: "s", type: "section", label: "Trabajos", description: "d" }), {})).toEqual({
      kind: "section",
      title: "Trabajos",
      description: "d",
    });
  });
  it("campo opcional sin responder -> empty", () => {
    expect(buildFieldDisplayValue(f({ id: "t", type: "text", label: "T" }), {})).toEqual({ kind: "empty" });
    expect(buildFieldDisplayValue(f({ id: "t", type: "text", label: "T" }), { t: null })).toEqual({ kind: "empty" });
  });
  it("text, number, date", () => {
    expect(buildFieldDisplayValue(f({ id: "t", type: "text", label: "T" }), { t: "hola" })).toEqual({ kind: "text", text: "hola" });
    expect(buildFieldDisplayValue(f({ id: "n", type: "number", label: "N" }), { n: 0 })).toEqual({ kind: "text", text: "0" });
    expect(buildFieldDisplayValue(f({ id: "d", type: "date", label: "D" }), { d: "2026-11-01" })).toEqual({ kind: "text", text: "2026-11-01" });
  });
  it("yes_no", () => {
    const field = f({ id: "y", type: "yes_no", label: "Y" });
    expect(buildFieldDisplayValue(field, { y: true })).toEqual({ kind: "text", text: "Sí" });
    expect(buildFieldDisplayValue(field, { y: false })).toEqual({ kind: "text", text: "No" });
  });
  it("single_choice usa la etiqueta, o el id si no existe", () => {
    const field = f({ id: "c", type: "single_choice", label: "C", config: { display: "radio", options: [{ id: "a", label: "Alfa" }] } });
    expect(buildFieldDisplayValue(field, { c: "a" })).toEqual({ kind: "text", text: "Alfa" });
    expect(buildFieldDisplayValue(field, { c: "zz" })).toEqual({ kind: "text", text: "zz" });
  });
  it("multiple_choice une las etiquetas", () => {
    const field = f({ id: "m", type: "multiple_choice", label: "M", config: { options: [{ id: "a", label: "Alfa" }, { id: "b", label: "Beta" }] } });
    expect(buildFieldDisplayValue(field, { m: ["a", "b"] })).toEqual({ kind: "text", text: "Alfa, Beta" });
  });
  it("photo, signature, gps", () => {
    const file = { key: "k" };
    expect(buildFieldDisplayValue(f({ id: "p", type: "photo", label: "P" }), { p: [file] })).toEqual({ kind: "photos", files: [file] });
    expect(buildFieldDisplayValue(f({ id: "s", type: "signature", label: "S" }), { s: file })).toEqual({ kind: "signature", file });
    const gps = { lat: 1, lng: 2, accuracy: 3, capturedAt: "2026-11-01T10:00:00.000Z" };
    expect(buildFieldDisplayValue(f({ id: "g", type: "gps", label: "G" }), { g: gps })).toEqual({ kind: "gps", value: gps });
  });
});

import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, FormVersionSchema } from "./form-version.schema";

const text = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: "text",
  label: id,
  required: false,
  config: {},
  ...extra,
});
const form = (fields: unknown[]) => ({ schemaVersion: CURRENT_SCHEMA_VERSION, title: "T", fields });
const messages = (f: unknown) => {
  const r = FormVersionSchema.safeParse(f);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("FormVersionSchema", () => {
  it("RF-FSC-02 — accepts metadata, theme and ordered fields", () => {
    const r = FormVersionSchema.safeParse({
      ...form([text("a"), text("b")]),
      description: "d",
      theme: { primaryColor: "#000000" },
    });
    expect(r.success).toBe(true);
  });

  it("RF-FSC-02 — rejects wrong schemaVersion, empty title and no fields", () => {
    expect(FormVersionSchema.safeParse({ ...form([text("a")]), schemaVersion: 2 }).success).toBe(false);
    expect(FormVersionSchema.safeParse({ ...form([text("a")]), title: "" }).success).toBe(false);
    expect(FormVersionSchema.safeParse(form([])).success).toBe(false);
  });

  it("CA-FSC-01 — rejects duplicate field ids naming the id", () => {
    const r = FormVersionSchema.safeParse(form([text("dup"), text("dup")]));
    expect(r.success).toBe(false);
    expect(messages(form([text("dup"), text("dup")]))).toContain('Id de campo duplicado: "dup".');
  });

  it("CA-FSC-05 — rejects visibleIf to a missing field", () => {
    const f = form([text("a", { visibleIf: { fieldId: "ghost", operator: "isAnswered" } })]);
    expect(messages(f)).toContain('"ghost" no existe.');
  });

  it("CA-FSC-05 — rejects visibleIf to a later field", () => {
    const f = form([text("a", { visibleIf: { fieldId: "b", operator: "isAnswered" } }), text("b")]);
    expect(messages(f).join()).toContain('"b" es posterior');
  });

  it("CA-FSC-05 — rejects visibleIf to itself", () => {
    const f = form([text("a", { visibleIf: { fieldId: "a", operator: "isAnswered" } })]);
    expect(messages(f).join()).toContain('"a" es posterior o es el propio campo');
  });

  it("RF-FSC-07 — circular references are rejected", () => {
    const f = form([
      text("a", { visibleIf: { fieldId: "b", operator: "isAnswered" } }),
      text("b", { visibleIf: { fieldId: "a", operator: "isAnswered" } }),
    ]);
    expect(FormVersionSchema.safeParse(f).success).toBe(false);
  });

  it("RF-FSC-07 — accepts visibleIf to an earlier field", () => {
    const f = form([text("a"), text("b", { visibleIf: { fieldId: "a", operator: "isAnswered" } })]);
    expect(FormVersionSchema.safeParse(f).success).toBe(true);
  });
});

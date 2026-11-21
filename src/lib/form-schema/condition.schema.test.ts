import { describe, expect, it } from "vitest";
import { VisibleIfSchema, evaluateCondition, isAnswered } from "./condition.schema";

describe("isAnswered", () => {
  it("treats empty values as unanswered", () => {
    for (const v of [undefined, null, "", "   ", []]) expect(isAnswered(v)).toBe(false);
  });
  it("treats other values as answered", () => {
    for (const v of ["a", 0, false, ["x"], {}]) expect(isAnswered(v)).toBe(true);
  });
});

describe("VisibleIfSchema", () => {
  it("RF-FSC-05 — requires value unless operator is isAnswered", () => {
    expect(VisibleIfSchema.safeParse({ fieldId: "a", operator: "equals" }).success).toBe(false);
    expect(VisibleIfSchema.safeParse({ fieldId: "a", operator: "isAnswered" }).success).toBe(true);
    expect(VisibleIfSchema.safeParse({ fieldId: "a", operator: "equals", value: 1 }).success).toBe(true);
  });
});

describe("evaluateCondition", () => {
  it("RF-FSC-05 — equals and notEquals", () => {
    expect(evaluateCondition({ fieldId: "a", operator: "equals", value: "x" }, { a: "x" })).toBe(true);
    expect(evaluateCondition({ fieldId: "a", operator: "equals", value: "x" }, { a: "y" })).toBe(false);
    expect(evaluateCondition({ fieldId: "a", operator: "notEquals", value: "x" }, { a: "y" })).toBe(true);
    expect(evaluateCondition({ fieldId: "a", operator: "notEquals", value: "x" }, { a: "x" })).toBe(false);
  });

  it("CA-FSC-06 — includes on a multiple_choice answer", () => {
    const cond = { fieldId: "a", operator: "includes", value: "o1" } as const;
    expect(evaluateCondition(cond, { a: ["o1", "o2"] })).toBe(true);
    expect(evaluateCondition(cond, { a: ["o2"] })).toBe(false);
    expect(evaluateCondition(cond, { a: "o1" })).toBe(false);
    expect(evaluateCondition(cond, {})).toBe(false);
  });

  it("CA-FSC-07 — isAnswered", () => {
    const cond = { fieldId: "a", operator: "isAnswered" } as const;
    expect(evaluateCondition(cond, {})).toBe(false);
    expect(evaluateCondition(cond, { a: "" })).toBe(false);
    expect(evaluateCondition(cond, { a: "hola" })).toBe(true);
  });
});

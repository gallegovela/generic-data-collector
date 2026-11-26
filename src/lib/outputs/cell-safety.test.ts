import { describe, expect, it } from "vitest";
import { neutralizeFormula } from "./cell-safety";

describe("neutralizeFormula", () => {
  // Cubre: RF-OUT-12, CA-OUT-05
  it.each(["=1+1", "=SUMA(A1)", "-1+1", "+1a", "-x", "@a", "\t=1", "\r=1"])(
    "CA-OUT-05: prefija con ' el valor %j",
    (value) => {
      expect(neutralizeFormula(value)).toBe(`'${value}`);
    },
  );

  // Cubre: RF-OUT-12, CA-OUT-05
  it.each(["-3.5", "40.4, -3.7", "+34600123456", "12"])(
    "CA-OUT-05: deja intacto el número o coordenada %j",
    (value) => {
      expect(neutralizeFormula(value)).toBe(value);
    },
  );

  // Cubre: RF-OUT-12, CA-OUT-05
  it("CA-OUT-05: deja intacto el texto normal y la cadena vacía", () => {
    expect(neutralizeFormula("Obra 1")).toBe("Obra 1");
    expect(neutralizeFormula("a=b")).toBe("a=b");
    expect(neutralizeFormula("")).toBe("");
  });
});

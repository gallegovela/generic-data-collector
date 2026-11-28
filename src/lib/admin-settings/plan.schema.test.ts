import { describe, expect, it } from "vitest";
import { formatMb, mbToBytes, planInputSchema } from "./plan.schema";

const base = { name: "Pro", maxImpressionsPerHour: 10, maxSubmissionsPerHour: 5, maxFileBytes: 1024 };

describe("planInputSchema", () => {
  // Cubre: RF-SET-04, RF-SET-09
  it("acepta límites positivos y null (sin límite)", () => {
    expect(planInputSchema.safeParse(base).success).toBe(true);
    expect(
      planInputSchema.safeParse({ ...base, maxImpressionsPerHour: null, maxSubmissionsPerHour: null, maxFileBytes: null })
        .success,
    ).toBe(true);
  });

  it("rechaza 0, negativos y decimales", () => {
    for (const bad of [0, -1, 1.5]) {
      expect(planInputSchema.safeParse({ ...base, maxSubmissionsPerHour: bad }).success).toBe(false);
    }
    expect(planInputSchema.safeParse({ ...base, maxFileBytes: Number.NaN }).success).toBe(false);
  });

  it("rechaza un nombre vacío", () => {
    expect(planInputSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
  });
});

describe("MB", () => {
  it("convierte MB a bytes y vacío a null", () => {
    expect(mbToBytes("1")).toBe(1048576);
    expect(mbToBytes("0,5")).toBe(524288);
    expect(mbToBytes("")).toBeNull();
    expect(mbToBytes(null)).toBeNull();
    expect(mbToBytes("abc")).toBeNaN();
  });

  it("formatea bytes como MB", () => {
    expect(formatMb(1048576)).toBe("1 MB");
    expect(formatMb(524288)).toBe("0,5 MB");
    expect(formatMb(10485760)).toBe("10 MB");
  });
});

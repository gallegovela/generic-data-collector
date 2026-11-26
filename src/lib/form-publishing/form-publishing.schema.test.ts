import { describe, expect, it } from "vitest";
import { publishFormSchema, qrQuerySchema, setAccessModeSchema } from "./form-publishing.schema";

describe("form-publishing.schema", () => {
  // Cubre: RF-PUB-09
  it("RF-PUB-09: acepta registered y public y rechaza otros modos", () => {
    expect(publishFormSchema.safeParse({ accessMode: "registered" }).success).toBe(true);
    expect(setAccessModeSchema.safeParse({ accessMode: "public" }).success).toBe(true);
    expect(publishFormSchema.safeParse({ accessMode: "open" }).success).toBe(false);
    expect(setAccessModeSchema.safeParse({}).success).toBe(false);
  });

  // Cubre: RF-PUB-05
  it("RF-PUB-05: qrQuerySchema usa png por defecto y rechaza gif", () => {
    expect(qrQuerySchema.parse({}).format).toBe("png");
    expect(qrQuerySchema.safeParse({ format: "gif" }).success).toBe(false);
    expect(qrQuerySchema.parse({ format: "svg", download: "1" })).toEqual({
      format: "svg",
      download: "1",
    });
  });
});

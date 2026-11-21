import { describe, expect, it } from "vitest";
import { ThemeSnapshotSchema } from "./theme.schema";

describe("ThemeSnapshotSchema", () => {
  it("RF-FSC-02 — accepts a valid theme and an empty one", () => {
    expect(
      ThemeSnapshotSchema.safeParse({
        primaryColor: "#112233",
        secondaryColor: "#AABBCC",
        fontFamily: "Inter",
        logoKey: "logos/a.png",
      }).success,
    ).toBe(true);
    expect(ThemeSnapshotSchema.safeParse({}).success).toBe(true);
  });
  it("RF-FSC-02 — rejects malformed colors", () => {
    expect(ThemeSnapshotSchema.safeParse({ primaryColor: "red" }).success).toBe(false);
    expect(ThemeSnapshotSchema.safeParse({ secondaryColor: "#123" }).success).toBe(false);
  });
});

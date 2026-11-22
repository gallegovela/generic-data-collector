import { describe, expect, it } from "vitest";
import { resolvePlaceholderFileUrl } from "./file-placeholder";

// Cubre: RF-SUB-08
describe("resolvePlaceholderFileUrl", () => {
  it("devuelve el marcador según el tipo", () => {
    expect(resolvePlaceholderFileUrl({ key: "a" }, "photo")).toBe("/placeholder-photo.svg");
    expect(resolvePlaceholderFileUrl({ key: "a" }, "signature")).toBe("/placeholder-signature.svg");
  });
});

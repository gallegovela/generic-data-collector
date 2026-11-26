import { describe, expect, it } from "vitest";
import { buildFormLink } from "./form-link";

describe("buildFormLink", () => {
  // Cubre: CA-PUB-02
  it("CA-PUB-02: sin barra final", () => {
    expect(buildFormLink("https://formia.test", "abc")).toBe("https://formia.test/f/abc");
  });

  // Cubre: CA-PUB-02
  it("CA-PUB-02: con barra final", () => {
    expect(buildFormLink("https://formia.test/", "abc")).toBe("https://formia.test/f/abc");
  });
});

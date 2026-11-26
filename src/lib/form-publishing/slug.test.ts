import { describe, expect, it } from "vitest";
import { generateSlug, isValidSlug, SLUG_LENGTH } from "./slug";

describe("slug", () => {
  // Cubre: RNF-PUB-01
  it("RNF-PUB-01: genera 10 caracteres del alfabeto permitido", () => {
    const slug = generateSlug();
    expect(slug).toHaveLength(SLUG_LENGTH);
    expect(isValidSlug(slug)).toBe(true);
  });

  // Cubre: RNF-PUB-01
  it("RNF-PUB-01: 1000 slugs no se repiten", () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateSlug()));
    expect(set.size).toBe(1000);
  });

  // Cubre: RNF-PUB-01
  it("RNF-PUB-01: isValidSlug rechaza mayúsculas, 0, 1, l, i y longitud incorrecta", () => {
    expect(isValidSlug("ABCDEFGHJK")).toBe(false);
    expect(isValidSlug("abcdefghj0")).toBe(false);
    expect(isValidSlug("abcdefghj1")).toBe(false);
    expect(isValidSlug("abcdefghjl")).toBe(false);
    expect(isValidSlug("abcdefghji")).toBe(false);
    expect(isValidSlug("abcdefghj")).toBe(false);
    expect(isValidSlug("abcdefghjkm")).toBe(false);
    expect(isValidSlug("abcdefghjk")).toBe(true);
  });
});

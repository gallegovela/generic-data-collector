import { describe, expect, it } from "vitest";
import { getFillAction } from "./fill-link";

describe("getFillAction", () => {
  // Cubre: CA-EDT-13
  it("CA-EDT-13: publicado con slug lleva a /f/<slug>", () => {
    expect(getFillAction({ status: "published", slug: "abc123" })).toEqual({
      available: true,
      href: "/f/abc123",
    });
  });

  // Cubre: CA-EDT-14
  it("CA-EDT-14: borrador no está disponible y explica por qué", () => {
    expect(getFillAction({ status: "draft", slug: null })).toEqual({
      available: false,
      reason: "Publica el formulario para poder rellenarlo",
    });
  });

  // Cubre: CA-EDT-14
  it("CA-EDT-14: despublicado con slug conservado no está disponible", () => {
    expect(getFillAction({ status: "draft", slug: "abc123" }).available).toBe(false);
  });

  // Cubre: CA-EDT-14
  it("CA-EDT-14: publicado sin slug no está disponible", () => {
    expect(getFillAction({ status: "published", slug: null }).available).toBe(false);
  });
});

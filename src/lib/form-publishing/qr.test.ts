import { describe, expect, it } from "vitest";
import { renderQr } from "./qr";

describe("renderQr", () => {
  // Cubre: CA-PUB-02
  it("CA-PUB-02: el PNG empieza por la cabecera PNG", async () => {
    const png = await renderQr("https://formia.test/f/abc", "png");
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  // Cubre: CA-PUB-02
  it("CA-PUB-02: el SVG empieza por <svg", async () => {
    const svg = await renderQr("https://formia.test/f/abc", "svg");
    expect(svg.startsWith("<svg")).toBe(true);
  });

  // Cubre: CA-PUB-02
  it("CA-PUB-02: dos URLs distintas dan salidas distintas", async () => {
    const a = await renderQr("https://formia.test/f/aaa", "svg");
    const b = await renderQr("https://formia.test/f/bbb", "svg");
    expect(a).not.toBe(b);
  });
});

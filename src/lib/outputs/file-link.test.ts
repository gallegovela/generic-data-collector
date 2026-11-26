import { describe, expect, it } from "vitest";
import { buildFileExportLink } from "./file-link";

describe("buildFileExportLink", () => {
  // Cubre: RF-OUT-06
  it("RF-OUT-06: codifica la clave con / y espacios", () => {
    expect(buildFileExportLink("https://app.test", { key: "org 1/foto 1.jpg" })).toBe(
      "https://app.test/api/files/org%201%2Ffoto%201.jpg",
    );
  });

  // Cubre: RF-OUT-06
  it("RF-OUT-06: ignora la barra final de baseUrl y no añade firma ni caducidad", () => {
    const link = buildFileExportLink("https://app.test/", { key: "k" });
    expect(link).toBe("https://app.test/api/files/k");
    expect(link).not.toContain("?");
  });
});

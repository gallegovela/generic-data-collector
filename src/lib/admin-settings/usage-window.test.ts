import { describe, expect, it } from "vitest";
import { SETTINGS_SECTIONS } from "./settings-sections";
import { currentWindowStart } from "./usage-window";

describe("currentWindowStart", () => {
  // Cubre: RF-SET-08
  it("trunca a la hora natural UTC", () => {
    expect(currentWindowStart(new Date("2026-03-10T10:59:59.999Z")).toISOString()).toBe("2026-03-10T10:00:00.000Z");
    expect(currentWindowStart(new Date("2026-03-10T11:00:00.000Z")).toISOString()).toBe("2026-03-10T11:00:00.000Z");
  });
});

describe("SETTINGS_SECTIONS", () => {
  // Cubre: RF-SET-02
  it("contiene la sección de planes", () => {
    expect(SETTINGS_SECTIONS.map((s) => s.href)).toContain("/admin/settings/plans");
  });
});

import { describe, expect, it } from "vitest";
import { canPublishDraft } from "./can-publish";

describe("canPublishDraft", () => {
  // Cubre: RF-PUB-01
  it("RF-PUB-01: es false con isPending, saving, invalid y error", () => {
    expect(canPublishDraft("idle", true)).toBe(false);
    expect(canPublishDraft("saving", false)).toBe(false);
    expect(canPublishDraft("invalid", false)).toBe(false);
    expect(canPublishDraft("error", false)).toBe(false);
  });

  // Cubre: RF-PUB-01
  it("RF-PUB-01: es true en idle y saved sin cambios pendientes", () => {
    expect(canPublishDraft("idle", false)).toBe(true);
    expect(canPublishDraft("saved", false)).toBe(true);
  });
});

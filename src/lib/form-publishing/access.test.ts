import { describe, expect, it } from "vitest";
import { decideAccess } from "./access";

describe("decideAccess", () => {
  // Cubre: CA-PUB-04
  it("CA-PUB-04: public permite con y sin usuario", () => {
    expect(decideAccess("public", "o1", null)).toBe("allow");
    expect(decideAccess("public", "o1", { organizationId: "o2" })).toBe("allow");
  });

  // Cubre: CA-PUB-04
  it("CA-PUB-04: registered sin usuario pide login", () => {
    expect(decideAccess("registered", "o1", null)).toBe("login-required");
  });

  // Cubre: CA-PUB-04
  it("CA-PUB-04: registered con usuario de otra organización es forbidden", () => {
    expect(decideAccess("registered", "o1", { organizationId: "o2" })).toBe("forbidden");
  });

  // Cubre: CA-PUB-04
  it("CA-PUB-04: registered con usuario de la organización permite", () => {
    expect(decideAccess("registered", "o1", { organizationId: "o1" })).toBe("allow");
  });
});

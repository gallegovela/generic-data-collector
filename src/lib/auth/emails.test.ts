import { describe, expect, it } from "vitest";
import { buildInvitationEmail, buildMagicLinkEmail } from "./emails";

describe("buildMagicLinkEmail", () => {
  // Cubre: RF-AUT-02
  it("incluye la URL recibida en el HTML y en el texto", () => {
    const url = "http://localhost:3000/login/magic?token=abc123";
    const email = buildMagicLinkEmail(url);

    expect(email.html).toContain(url);
    expect(email.text).toContain(url);
    expect(email.subject.length).toBeGreaterThan(0);
  });
});

describe("buildInvitationEmail", () => {
  // Cubre: RF-AUT-04
  it("incluye la URL y el nombre de la organización en el HTML y en el texto", () => {
    const url = "http://localhost:3000/invite/abc123";
    const email = buildInvitationEmail(url, "Constructora Demo");

    expect(email.html).toContain(url);
    expect(email.html).toContain("Constructora Demo");
    expect(email.text).toContain(url);
    expect(email.text).toContain("Constructora Demo");
  });
});

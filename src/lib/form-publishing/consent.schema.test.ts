import { describe, expect, it } from "vitest";
import {
  ConsentInputSchema,
  HttpsUrlSchema,
  MAX_CONSENT_URL_LENGTH,
  parseStoredConsent,
  toPublicConsent,
} from "./consent.schema";
import { TEST_CONSENT_INPUT } from "./consent.fixtures";
import { publishFormSchema } from "./form-publishing.schema";

// Cubre: CA-PUB-08
describe("CA-PUB-08", () => {
  it("HttpsUrlSchema acepta un enlace https con consulta", () => {
    expect(HttpsUrlSchema.safeParse("https://example.com/t?x=1").success).toBe(true);
  });

  it.each([
    "http://example.com",
    "javascript:alert(1)",
    "data:text/html,hola",
    "https://user:pass@x.com",
    "",
    `https://example.com/${"a".repeat(MAX_CONSENT_URL_LENGTH)}`,
  ])("HttpsUrlSchema rechaza %s", (value) => {
    expect(HttpsUrlSchema.safeParse(value).success).toBe(false);
  });

  it("ConsentInputSchema rechaza publisherDeclaration false", () => {
    expect(ConsentInputSchema.safeParse({ ...TEST_CONSENT_INPUT, publisherDeclaration: false }).success).toBe(
      false,
    );
    expect(ConsentInputSchema.safeParse(TEST_CONSENT_INPUT).success).toBe(true);
  });

  it("publishFormSchema: public sin consent falla con path consent; registered sin consent pasa", () => {
    const result = publishFormSchema.safeParse({ accessMode: "public" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["consent"]);
    expect(publishFormSchema.safeParse({ accessMode: "registered" }).success).toBe(true);
    expect(publishFormSchema.safeParse({ accessMode: "public", consent: TEST_CONSENT_INPUT }).success).toBe(
      true,
    );
  });

  it("toPublicConsent no expone declaredBy* y parseStoredConsent no lanza", () => {
    const stored = {
      termsUrl: TEST_CONSENT_INPUT.termsUrl,
      privacyUrl: TEST_CONSENT_INPUT.privacyUrl,
      declaredByUserId: "u1",
      declaredAt: new Date().toISOString(),
    };
    expect(toPublicConsent(stored)).toEqual({
      termsUrl: stored.termsUrl,
      privacyUrl: stored.privacyUrl,
    });
    expect(parseStoredConsent(stored)).toEqual(stored);
    expect(parseStoredConsent(null)).toBeNull();
    expect(parseStoredConsent({ termsUrl: "x" })).toBeNull();
  });
});

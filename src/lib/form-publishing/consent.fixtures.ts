import type { ConsentInput } from "./consent.schema";

/** Términos válidos para los tests que publican en modo `public`. */
export const TEST_CONSENT_INPUT: ConsentInput = {
  termsUrl: "https://example.com/terminos",
  privacyUrl: "https://example.com/privacidad",
  publisherDeclaration: true,
};

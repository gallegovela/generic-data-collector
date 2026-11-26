import { randomInt } from "node:crypto";

export const SLUG_LENGTH = 10;
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const SLUG_REGEX = /^[a-hjkmnp-z2-9]{10}$/;

/**
 * Slug corto no adivinable (10 símbolos, ≈ 49,5 bits) con `crypto.randomInt`.
 *
 * Cubre: RNF-PUB-01
 */
export function generateSlug(): string {
  let slug = "";
  for (let i = 0; i < SLUG_LENGTH; i++) {
    slug += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return slug;
}

export function isValidSlug(value: string): boolean {
  return SLUG_REGEX.test(value);
}

export const LOGIN_CODE_LENGTH = 6;

// Uppercase letters and digits without the look-alikes (no 0, O, 1, I, L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** What the code field holds: uppercase, only characters the server can send, at most 6. */
export function normalizeLoginCode(text: string): string {
  return [...text.toUpperCase()].filter((c) => ALPHABET.includes(c)).join("").slice(0, LOGIN_CODE_LENGTH);
}

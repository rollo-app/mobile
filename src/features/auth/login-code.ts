export const LOGIN_CODE_LENGTH = 6;

// Uppercase letters and digits without the look-alikes (no 0, O, 1, I, L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const isCodeChar = (c: string) => ALPHABET.includes(c);

/**
 * What the code field holds: uppercase, only characters the server can send, at most 6.
 * Text pasted or inserted by iOS AutoFill can carry more than the code ("Tu código de Rollo es K7M4QX",
 * the code twice): a standalone 6-character word made of the alphabet wins; otherwise the first 6 valid
 * characters.
 */
export function normalizeLoginCode(text: string): string {
  const upper = text.toUpperCase();
  const token = upper
    .split(/[^A-Z0-9]+/)
    .find((word) => word.length === LOGIN_CODE_LENGTH && [...word].every(isCodeChar));
  if (token) return token;
  return [...upper].filter(isCodeChar).join("").slice(0, LOGIN_CODE_LENGTH);
}

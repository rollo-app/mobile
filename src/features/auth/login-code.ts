export const LOGIN_CODE_LENGTH = 6;

// Uppercase letters and digits without the look-alikes (no 0, O, 1, I, L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const isCodeChar = (c: string) => ALPHABET.includes(c);

function extract(text: string): string {
  const upper = text.toUpperCase();
  const tokens = upper
    .split(/[^A-Z0-9]+/)
    .filter((word) => word.length === LOGIN_CODE_LENGTH && [...word].every(isCodeChar));
  // A word like "ENTRAR" can look like a code: prefer one with digits, and the last one (the code ends the sentence).
  const token = tokens.filter((word) => /\d/.test(word)).at(-1) ?? tokens.at(-1);
  if (token) return token;
  return [...upper].filter(isCodeChar).join("").slice(0, LOGIN_CODE_LENGTH);
}

/**
 * What the code field holds: uppercase, only characters the server can send, at most 6.
 * Text pasted or inserted by iOS AutoFill can carry more than the code ("Tu código de Rollo es K7M4QX",
 * the code twice): a standalone 6-character word made of the alphabet wins; otherwise the first 6 valid
 * characters. With `previous` (what the field held), a whole new code inserted next to it wins over the
 * old one, so AutoFill after a failed code doesn't send the old code again.
 */
export function normalizeLoginCode(text: string, previous = ""): string {
  if (previous && text.length > previous.length) {
    let start = 0;
    while (start < previous.length && text[start] === previous[start]) start++;
    let end = 0;
    while (end < previous.length - start && text[text.length - 1 - end] === previous[previous.length - 1 - end]) end++;
    const inserted = extract(text.slice(start, text.length - end));
    if (inserted.length === LOGIN_CODE_LENGTH) return inserted;
  }
  return extract(text);
}

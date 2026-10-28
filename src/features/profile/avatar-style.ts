import { API_URL } from "@/config";
import { memberColor } from "@/features/map/member-color";

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const MARK = /\p{M}/u;

/**
 * First letter or digit of the name (skipping emoji, punctuation and spaces), uppercase, with its combining marks.
 * Null when there is none. Never a multi-character uppercase ("ß" stays "ß").
 */
export function initialOf(name: string | null | undefined): string | null {
  const chars = Array.from(name ?? "");
  const start = chars.findIndex((c) => LETTER_OR_DIGIT.test(c));
  if (start === -1) return null;
  let end = start + 1;
  while (end < chars.length && MARK.test(chars[end]!)) end++;
  const original = chars.slice(start, end).join("");
  const upper = original.toLocaleUpperCase("es");
  const letters = Array.from(upper).filter((c) => !MARK.test(c));
  return letters.length === 1 ? upper : original;
}

/** Same color for a person everywhere (feed, map, avatars): derived from their id. */
export const avatarColor = memberColor;

/** `avatarUrl` comes from the API as a public path (/avatars/…): it needs the base URL, no token. */
export function avatarUri(avatarUrl: string | null | undefined, baseUrl: string = API_URL): string | null {
  return avatarUrl ? `${baseUrl}${avatarUrl}` : null;
}

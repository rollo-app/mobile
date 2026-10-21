const SCHEME_PREFIX = /^rollo:\/\/amigos\//i;

/** The link that makes whoever opens it your friend. */
export function friendLinkUrl(code: string): string {
  return `rollo://amigos/${code}`;
}

/** The 8-character code out of a full link or a typed code (any case, spaces and dashes); null if it isn't one. */
export function parseFriendCode(input: string): string | null {
  const code = input.trim().replace(SCHEME_PREFIX, "").replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{8}$/.test(code) ? code : null;
}

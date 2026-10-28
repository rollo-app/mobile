import { SITE_URL } from "@/config";

const SCHEME_PREFIX = /^rollo:\/\/friends\//i;
const HTTPS_LINK = /^https:\/\/rollo\.juanifraga\.com(?::443)?\/friends\/?(?:\?[^#]*)?(?:#(.*))?$/i;

/** What a route gets when an https friend link has no usable code: the screen reports it as a dead link. */
const INVALID_CODE_SEGMENT = "invalid";

/** The link that makes whoever opens it your friend (a Universal Link that opens the app). */
export function friendLinkUrl(code: string): string {
  return `${SITE_URL}/friends#${code}`;
}

/** The raw code of an https friend link (fragment, may be empty); null if the URL isn't one. */
function httpsFragment(input: string): string | null {
  const match = HTTPS_LINK.exec(input.trim());
  return match ? (match[1] ?? "") : null;
}

/** The 8-character code out of a full link or a typed code (any case, spaces and dashes); null if it isn't one. */
export function parseFriendCode(input: string): string | null {
  const fragment = httpsFragment(input);
  const raw = fragment ?? input.trim().replace(SCHEME_PREFIX, "");
  const code = raw.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{8}$/.test(code) ? code : null;
}

/** The in-app route for an https friend link (`/friends/<CODE>`); null if the URL isn't a friend link. */
export function friendLinkPath(url: string): string | null {
  if (httpsFragment(url) === null) return null;
  const code = parseFriendCode(url);
  return `/friends/${code ?? INVALID_CODE_SEGMENT}`;
}

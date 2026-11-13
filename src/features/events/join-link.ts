import { SITE_URL } from "@/config";

const SCHEME_PREFIX = /^rollo:\/\/join\/([^/?#]*)\/?(?:[?#].*)?$/i;
// rollo.juanifraga.com: the old host, kept for consistency with the friend link.
const HTTPS_LINK = /^https:\/\/(?:rolloproject\.com|rollo\.juanifraga\.com)(?::443)?\/join\/([^/?#]*)\/?(?:[?#].*)?$/i;

/** The 6-character code out of a join link; null if the URL isn't one or the code isn't valid. */
export function parseJoinLinkCode(url: string): string | null {
  const match = HTTPS_LINK.exec(url.trim()) ?? SCHEME_PREFIX.exec(url.trim());
  if (!match) return null;
  const code = decodeURIComponent(match[1] ?? "").replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

/** The in-app route for a join link (`/join?code=<CODE>`); null if the URL isn't one with a valid code. */
export function joinLinkPath(url: string): string | null {
  const code = parseJoinLinkCode(url);
  return code ? `/join?code=${code}` : null;
}

/** The public link that opens an event's join screen (the QR and the shared invitation carry it). */
export const joinLinkUrl = (code: string): string => `${SITE_URL}/join/${code}`;

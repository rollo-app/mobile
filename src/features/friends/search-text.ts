/** Minimum normalized length before searching (the server answers 400 below it). */
export const SEARCH_MIN = 2;
/** Maximum normalized length the server accepts (it answers 400 above it). */
export const SEARCH_MAX = 30;

/** Folds text the same way the server does: no accents, lowercase, single spaces. Order matters. */
export function searchText(input: string): string {
  return input.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

/** A typed query: trimmed, every leading "@" dropped, then folded. */
export function normalizeSearch(raw: string): string {
  return searchText(raw.trim().replace(/^@+/, ""));
}

/** What goes to the server: the normalized query cut to the server maximum. */
export function searchQuery(raw: string): string {
  return normalizeSearch(raw).slice(0, SEARCH_MAX).trimEnd();
}

/** Mirrors the server: username starts with `q`, or some word of the name does. `q` is already normalized. */
export function matchesSearch(user: { name: string; username: string | null }, q: string): boolean {
  if (!q) return false;
  if (user.username && searchText(user.username).startsWith(q)) return true;
  return (" " + searchText(user.name)).includes(" " + q);
}

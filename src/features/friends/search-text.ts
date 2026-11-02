/** Minimum normalized length before searching (the server answers 400 below it). */
export const SEARCH_MIN = 2;

/** Folds text the same way the server does: no accents, lowercase, single spaces. Order matters. */
export function searchText(input: string): string {
  return input.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

/** A typed query: trimmed, one leading "@" dropped, then folded. */
export function normalizeSearch(raw: string): string {
  const trimmed = raw.trim();
  return searchText(trimmed.startsWith("@") ? trimmed.slice(1) : trimmed);
}

/** Mirrors the server: username starts with `q`, or some word of the name does. `q` is already normalized. */
export function matchesSearch(user: { name: string; username: string | null }, q: string): boolean {
  if (!q) return false;
  if (user.username && searchText(user.username).startsWith(q)) return true;
  return (" " + searchText(user.name)).includes(" " + q);
}

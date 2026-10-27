/** Thousands with a dot ("1.284"); manual because CLDR "es" skips the separator on 4 digits. */
function formatCount(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * "12 amigos", "1 amigo", plus " · 3 en común" when someone else's profile shares friends with you.
 * Returns null when there is nothing worth showing: no friends (on your own profile it reads "Todavía
 * no tenés amigos" instead), or a hidden list with none in common.
 */
export function formatFriendCount(count: number, mutual = 0, canSee = true, own = false): string | null {
  if (count === 0) return own ? "Todavía no tenés amigos" : null;
  if (!canSee && mutual === 0) return null;
  const base = `${formatCount(count)} ${count === 1 ? "amigo" : "amigos"}`;
  return mutual > 0 ? `${base} · ${formatCount(mutual)} en común` : base;
}

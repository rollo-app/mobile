/**
 * "12 amigos", "1 amigo", plus " · 3 en común" when someone else's profile shares friends with you.
 * Returns null when there is nothing worth showing: no friends, or a hidden list with none in common.
 */
export function formatFriendCount(count: number, mutual = 0, canSee = true): string | null {
  if (count === 0) return null;
  if (!canSee && mutual === 0) return null;
  const base = `${count} ${count === 1 ? "amigo" : "amigos"}`;
  return mutual > 0 ? `${base} · ${mutual} en común` : base;
}

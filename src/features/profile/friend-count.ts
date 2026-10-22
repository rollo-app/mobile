/** "12 amigos", "1 amigo", and " · 3 en común" when someone else's profile shares friends with you. */
export function formatFriendCount(count: number, mutual = 0): string {
  const base = `${count} ${count === 1 ? "amigo" : "amigos"}`;
  return mutual > 0 ? `${base} · ${mutual} en común` : base;
}

export const SHEET_FRAMES = 18;

type Frame = { id?: string; takenAt: number; thumbhash: string | null };

/**
 * The contact sheet frames: the ThumbHashes of what's uploaded and what's pending, newest
 * to oldest, up to `limit`. `null` is a frame without colors (no thumbhash, or a
 * photo we don't know yet). `keys` is a stable identity per frame (the item id, else its
 * capture time; unknown frames by position). `rest` is how many are left out, for the "+N".
 */
export function buildContactSheet({
  feed,
  pending,
  total,
  limit = SHEET_FRAMES,
}: {
  feed: Frame[];
  pending: Frame[];
  total: number;
  limit?: number;
}): { frames: (string | null)[]; keys: string[]; rest: number } {
  const shown = Math.max(Math.min(total, limit), 0);
  const known = [...feed, ...pending].sort((a, b) => b.takenAt - a.takenAt);
  const frames = Array.from({ length: shown }, (_, i) => known[i]?.thumbhash ?? null);
  const keys = Array.from({ length: shown }, (_, i) => (known[i] ? (known[i].id ?? `t${known[i].takenAt}`) : `empty-${i}`));
  return { frames, keys, rest: Math.max(total - shown, 0) };
}

/**
 * The key of the frame that just entered: only when the total grew since the previous render
 * and the newest frame wasn't there before. `null` on the first render (nothing to compare).
 */
export function newestEntered(
  prev: { keys: string[]; total: number } | null,
  next: { keys: string[]; total: number },
): string | null {
  if (!prev || next.total <= prev.total) return null;
  const newest = next.keys[0];
  if (newest === undefined || prev.keys.includes(newest)) return null;
  return newest;
}

export const SHEET_FRAMES = 18;

type Frame = { takenAt: number; thumbhash: string | null };

/**
 * The contact sheet frames: the ThumbHashes of what's uploaded and what's pending, newest
 * to oldest, up to `limit`. `null` is a frame without colors (no thumbhash, or a
 * photo we don't know yet). `rest` is how many are left out, for the "+N".
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
}): { frames: (string | null)[]; rest: number } {
  const shown = Math.max(Math.min(total, limit), 0);
  const known = [...feed, ...pending].sort((a, b) => b.takenAt - a.takenAt).map((x) => x.thumbhash);
  const frames = Array.from({ length: shown }, (_, i) => known[i] ?? null);
  return { frames, rest: Math.max(total - shown, 0) };
}

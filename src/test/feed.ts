import type { FeedPages } from "@/features/trips/actions";

type Item = Record<string, unknown> & { id: string };

/** Feed items with just an id (and whatever else a test sets), enough for cache tests. */
export const feedItem = (id: string, extra: Record<string, unknown> = {}): Item => ({ id, type: "photo", takenAt: 1, ...extra });

/**
 * A paged feed cache value: one page per list of items, every page but the last pointing to a next one.
 * Shaped like the real thing (`revealed`, `revealAt`, `nextCursor`, `pageParams`).
 */
export function feedPagesOf(...pages: Item[][]): FeedPages {
  return {
    pages: pages.map((items, i) => ({ revealed: true, revealAt: 1, items, nextCursor: i < pages.length - 1 ? `c${i + 1}` : null })),
    pageParams: pages.map((_, i) => (i === 0 ? undefined : `c${i}`)),
  } as unknown as FeedPages;
}

/** The ids across every page of a paged feed cache value, in order. */
export const feedIds = (data: FeedPages | undefined) => data?.pages.flatMap((p) => p.items.map((i) => i.id));

/** One whole feed response as a single-page paged cache value (the shape a trip's feed cache stores). */
export const pagedFeed = (page: Record<string, unknown>): FeedPages =>
  ({ pages: [{ nextCursor: null, ...page }], pageParams: [undefined] }) as unknown as FeedPages;

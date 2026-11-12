import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { FEED_BULK_PAGE_SIZE, FEED_PAGE_SIZE, fetchFeedPage, type Feed, type FeedOrder, type FeedPages } from "./actions";

/**
 * Root of every trip's feed cache. It's "feed-pages" and not "feed" on purpose: the cache is persisted on the phone, and
 * the old `["feed", tripId]` entries hold a whole feed (not pages), so nothing paged may ever read them. They just expire.
 */
export const feedRootKey = ["feed-pages"] as const;
/**
 * The key of a trip's feed. It's also the prefix of all of that trip's feed caches (cache edits and invalidations use it to reach
 * both orders). Oldest first (`asc`) is exactly `["feed-pages", tripId]`, as already persisted on phones, so it must never change;
 * newest first is its own query, `[..., "desc"]`, because pages of one order can't continue the other.
 */
export function feedKey(tripId: string): readonly ["feed-pages", string];
export function feedKey(tripId: string, order: FeedOrder): readonly ["feed-pages", string] | readonly ["feed-pages", string, "desc"];
export function feedKey(tripId: string, order: FeedOrder = "asc") {
  return order === "desc" ? ([...feedRootKey, tripId, "desc"] as const) : ([...feedRootKey, tripId] as const);
}

/** `lazy`: only loads more when asked (`fetchMore`). `all`: keeps loading by itself until the last page, for screens that need everything. */
export type FeedMode = "lazy" | "all";

/** What a page request needs: where it starts and how many items it asks for (the size is decided per call, see `useFeed`). */
type PageParam = { cursor?: string; limit: number };

/** The pages as one feed: the first page's header, every page's items in order. */
function flatten(data: FeedPages): Feed {
  const first = data.pages[0]!;
  // Keep the first occurrence of an id: a refetch racing a page load can overlap pages, and a photo must never show twice.
  const seen = new Set<string>();
  const items = data.pages.flatMap((p) => p.items).filter((i) => !seen.has(i.id) && !!seen.add(i.id));
  return { revealed: first.revealed, revealAt: first.revealAt, items, nextCursor: null };
}

/**
 * What's been uploaded to the trip (before the reveal, metadata only). One shared, persisted cache per trip and order whatever
 * the mode, so changing screens doesn't start over. Page sizes: the first page is always 30 (fast first paint); scrolling
 * (`fetchMore`) asks for 30 more; everything that needs the whole feed (the "all" auto-loader, `loadAll`, refetches) asks for 100
 * per page, to spend fewer requests. The server paginates by keyset (the cursor is the last item), so pages of mixed sizes
 * in one cache neither overlap nor leave gaps. `feed` is everything loaded so far, even if stale;
 * `error` appears only if there's no data at all.
 */
export function useFeed(tripId: string | undefined, { mode = "all", order = "asc" }: { mode?: FeedMode; order?: FeedOrder } = {}) {
  // Size of the *next* page request. `getNextPageParam` reads it when a page is about to be fetched (also while a refetch walks the
  // cached pages: those use bulk size, so a refetch makes at most as many requests as pages are cached, and the first page stays 30).
  // Only `fetchMore` lowers it, around its own call.
  const nextLimit = useRef(FEED_BULK_PAGE_SIZE);
  const query = useInfiniteQuery<Feed, Error, FeedPages, readonly unknown[], PageParam>({
    queryKey: feedKey(tripId ?? "", order),
    // `order` goes on every page (first and cursor ones): the server wants the same one all along. Asc is the default: not sent.
    queryFn: ({ pageParam }) => fetchFeedPage(tripId!, { cursor: pageParam.cursor, limit: pageParam.limit, ...(order === "desc" && { order }) }),
    initialPageParam: { limit: FEED_PAGE_SIZE },
    getNextPageParam: (last) => (last?.nextCursor ? { cursor: last.nextCursor, limit: nextLimit.current } : undefined),
    enabled: !!tripId,
  });
  const { data, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = query;

  // Same identity until the pages change, so derived lists (and memoized grid cells) don't rebuild on every render.
  const feed = useMemo(() => (data?.pages[0] ? flatten(data) : null), [data]);

  // `data` is a dependency because a page can land without a render in between where `isFetching` was true. A refetch in flight loads the pages it already knows; wait for it. A failed page stops the loop (pull to refresh or `fetchMore` try again).
  useEffect(() => {
    if (mode === "all" && hasNextPage && !isFetching && !isFetchNextPageError) void fetchNextPage();
  }, [mode, data, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);

  // Not cancelling: asking again while a page is on its way joins it instead of restarting it.
  const fetchMore = useCallback(async () => {
    nextLimit.current = FEED_PAGE_SIZE;
    try {
      return await fetchNextPage({ cancelRefetch: false });
    } finally {
      nextLimit.current = FEED_BULK_PAGE_SIZE;
    }
  }, [fetchNextPage]);

  /** Loads every remaining page (whatever the mode) and resolves with the whole feed; `complete` is false if a page failed. */
  const loadAll = useCallback(async (): Promise<{ feed: Feed | null; complete: boolean }> => {
    let result = await fetchNextPage({ cancelRefetch: false });
    while (result.hasNextPage && !result.isFetchNextPageError) result = await fetchNextPage({ cancelRefetch: false });
    return { feed: result.data?.pages[0] ? flatten(result.data) : null, complete: !result.hasNextPage };
  }, [fetchNextPage]);

  return {
    feed,
    error: feed ? null : query.isError ? (query.error instanceof Error ? query.error.message : "No se pudo cargar el feed") : null,
    loading: !feed && query.isPending,
    refetch: query.refetch,
    isRefetching: query.isRefetching && !query.isFetchingNextPage,
    hasMore: !!hasNextPage,
    fetchMore,
    loadingMore: query.isFetchingNextPage,
    /** The last attempt to load the next page failed (what's loaded stays); `fetchMore` tries again. */
    loadMoreError: isFetchNextPageError,
    /** Every page is loaded. */
    complete: !!feed && !hasNextPage,
    loadAll,
  };
}

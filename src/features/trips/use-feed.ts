import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { FEED_PAGE_SIZE, fetchFeedPage, type Feed, type FeedPages } from "./actions";

/**
 * Root of every trip's feed cache. It's "feed-pages" and not "feed" on purpose: the cache is persisted on the phone, and
 * the old `["feed", tripId]` entries hold a whole feed (not pages), so nothing paged may ever read them. They just expire.
 */
export const feedRootKey = ["feed-pages"] as const;
export const feedKey = (tripId: string) => [...feedRootKey, tripId] as const;

/** `lazy`: only loads more when asked (`fetchMore`). `all`: keeps loading by itself until the last page, for screens that need everything. */
export type FeedMode = "lazy" | "all";

/** The pages as one feed: the first page's header, every page's items in order. */
function flatten(data: FeedPages): Feed {
  const first = data.pages[0]!;
  return { revealed: first.revealed, revealAt: first.revealAt, items: data.pages.flatMap((p) => p.items), nextCursor: null };
}

/**
 * What's been uploaded to the trip (before the reveal, metadata only), loaded in pages of 30. One shared, persisted cache per
 * trip whatever the mode, so changing screens doesn't start over. `feed` is everything loaded so far, even if stale;
 * `error` appears only if there's no data at all.
 */
export function useFeed(tripId: string | undefined, { mode = "all" }: { mode?: FeedMode } = {}) {
  const query = useInfiniteQuery<Feed, Error, FeedPages, ReturnType<typeof feedKey>, string | undefined>({
    queryKey: feedKey(tripId ?? ""),
    queryFn: ({ pageParam }) => fetchFeedPage(tripId!, { cursor: pageParam, limit: FEED_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last?.nextCursor ?? undefined,
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
  const fetchMore = useCallback(() => fetchNextPage({ cancelRefetch: false }), [fetchNextPage]);

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
    /** Every page is loaded. */
    complete: !!feed && !hasNextPage,
    loadAll,
  };
}

import { useQuery } from "@tanstack/react-query";
import { fetchFeed } from "./actions";

export const feedKey = (tripId: string) => ["feed", tripId] as const;

/**
 * What's been uploaded to the trip (before the reveal, metadata only). Shared, persisted cache: `feed`
 * is the latest known data even if stale; `error` appears only if there's no data at all.
 */
export function useFeed(tripId: string | undefined) {
  const query = useQuery({
    queryKey: feedKey(tripId ?? ""),
    queryFn: () => fetchFeed(tripId!),
    enabled: !!tripId,
  });

  const feed = query.data ?? null;
  return {
    feed,
    error: feed ? null : query.isError ? (query.error instanceof Error ? query.error.message : "No se pudo cargar el feed") : null,
    loading: !feed && query.isPending,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

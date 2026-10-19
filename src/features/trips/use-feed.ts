import { useQuery } from "@tanstack/react-query";
import { fetchFeed } from "./actions";

export const feedKey = (tripId: string) => ["feed", tripId] as const;

/**
 * Lo subido al viaje (antes del revelado, solo metadata). Cache compartido y persistido: `feed`
 * es lo último que se sabe aunque esté viejo; `error` aparece solo si no hay ningún dato.
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

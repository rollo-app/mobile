import { useQuery } from "@tanstack/react-query";
import { fetchContest } from "./actions";

export const contestKey = (tripId: string) => ["contest", tripId] as const;

/** The event's contest (persisted with the rest of the cache). Pass `enabled` false for events without one: it'd be a 404. */
export function useContest(tripId: string | undefined, enabled = true) {
  const query = useQuery({
    queryKey: contestKey(tripId ?? ""),
    queryFn: () => fetchContest(tripId!),
    enabled: !!tripId && enabled,
  });
  return {
    contest: query.data ?? null,
    error: query.data ? null : query.isError ? (query.error instanceof Error ? query.error.message : "No se pudo cargar el concurso") : null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

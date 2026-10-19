import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { fetchTrip } from "./actions";

export const tripKey = (tripId: string) => ["trip", tripId] as const;

/**
 * A trip's detail, shared by the tab bar, Roll, Me and capture: a
 * single request and a single cache (which survives closing the app). `detail` is the latest
 * known data even if stale; `error` appears only if there's no data at all. When a
 * screen gains focus it refetches only if the data is stale (30 s).
 */
export function useTripDetail(tripId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: tripKey(tripId ?? ""),
    queryFn: () => fetchTrip(tripId!),
    enabled: !!tripId,
  });

  // prefetchQuery only fetches if the data is stale, joins an in-flight request and doesn't throw.
  useFocusEffect(
    useCallback(() => {
      if (tripId) void queryClient.prefetchQuery({ queryKey: tripKey(tripId), queryFn: () => fetchTrip(tripId) });
    }, [tripId, queryClient]),
  );

  const detail = query.data ?? null;
  return {
    detail,
    error: detail ? null : query.isError ? messageOf(query.error) : null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo cargar el rollo";
}

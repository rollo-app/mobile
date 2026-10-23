import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { getQueue } from "./store";

export const pendingKey = (tripId: string) => ["pending", tripId] as const;

/**
 * Your photos and videos of a trip that have not been uploaded yet (the local queue, excluding
 * failed ones). Added to the server total so "En el rollo" goes up as soon as you take a
 * photo, with no signal. It is local, so it does not depend on the network; invalidated on enqueue and on
 * confirm or discard, and re-read on focus.
 */
export function usePendingCount(tripId: string | undefined) {
  const query = useQuery({
    queryKey: pendingKey(tripId ?? ""),
    queryFn: async () => (await getQueue()).countPendingForTrip(tripId!),
    enabled: !!tripId,
    networkMode: "always",
    staleTime: 0,
  });

  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (tripId) void refetch();
    }, [tripId, refetch]),
  );

  return query.data ?? 0;
}

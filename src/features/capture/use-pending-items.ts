import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { getQueue } from "./store";

export const pendingItemsKey = (tripId: string) => ["pending-items", tripId] as const;

/** Your not-yet-uploaded photos and videos of a trip that have a location: the map shows them as soon as you take them. */
export function usePendingItems(tripId: string | undefined) {
  const query = useQuery({
    queryKey: pendingItemsKey(tripId ?? ""),
    queryFn: async () => (await getQueue()).pendingForTrip(tripId!),
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

  return query.data ?? [];
}

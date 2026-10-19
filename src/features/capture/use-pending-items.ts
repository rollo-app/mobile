import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { getQueue } from "./store";

export const pendingItemsKey = (tripId: string) => ["pending-items", tripId] as const;

/** Tus fotos y videos sin subir de un viaje que tienen ubicación: el mapa las muestra apenas las sacás. */
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

import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { getQueue } from "./store";

export const pendingKey = (tripId: string) => ["pending", tripId] as const;

/**
 * Fotos y videos tuyos de un viaje que todavía no se subieron (la cola local, sin las
 * fallidas). Se suma al total del server para que "En el rollo" suba apenas sacás una
 * foto, sin señal. Es local, así que no depende de la red; se invalida al encolar y al
 * confirmar o descartar, y se relee al ganar foco.
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

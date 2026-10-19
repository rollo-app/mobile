import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { fetchTrip } from "./actions";

export const tripKey = (tripId: string) => ["trip", tripId] as const;

/**
 * Detalle de un viaje, compartido por la barra de tabs, Rollo, Vos y la captura: un
 * solo pedido y un solo cache (que sobrevive a cerrar la app). `detail` es lo último
 * que se sabe aunque esté viejo; `error` aparece solo si no hay ningún dato. Al ganar
 * foco una pantalla vuelve a pedir únicamente si los datos están viejos (30 s).
 */
export function useTripDetail(tripId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: tripKey(tripId ?? ""),
    queryFn: () => fetchTrip(tripId!),
    enabled: !!tripId,
  });

  // prefetchQuery solo pide si los datos están viejos, se suma a un pedido en curso y no tira.
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
  return error instanceof Error ? error.message : "No se pudo cargar el viaje";
}

import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { getActiveTripId } from "@/storage/active-trip";
import { fetchMyTrips } from "./actions";
import { pickActiveTrip } from "./active";

export const myTripsKey = ["myTrips"] as const;

/**
 * The trips you're in (from the server, cached and persisted) and the active one: the last one
 * you opened. The saved id is re-read every time the screen gains focus, so changing it from
 * the selector shows up on return.
 */
export function useActiveTrip() {
  const query = useQuery({ queryKey: myTripsKey, queryFn: fetchMyTrips });
  const [activeId, setActiveId] = useState<{ id: string | null; read: boolean }>({ id: null, read: false });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getActiveTripId().then((id) => active && setActiveId({ id, read: true }));
      return () => {
        active = false;
      };
    }, []),
  );

  const trips = query.data?.trips ?? [];
  return {
    trip: pickActiveTrip(trips, activeId.id),
    trips,
    loaded: activeId.read && !query.isPending,
    error: !query.data && query.isError ? (query.error instanceof Error ? query.error.message : "No se pudieron cargar tus rollos") : null,
    refetch: query.refetch,
  };
}

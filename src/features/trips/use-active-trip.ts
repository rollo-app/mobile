import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
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

  // A failed query goes back to "pending" while it retries: once the list has settled it stays loaded,
  // otherwise screens that swap on `loaded` would remount, retry again and loop.
  const settled = useRef(false);
  if (!query.isPending) settled.current = true;

  const trips = query.data?.trips ?? [];
  return {
    trip: pickActiveTrip(trips, activeId.id),
    trips,
    loaded: activeId.read && settled.current,
    error: !query.data && query.isError ? (query.error instanceof Error ? query.error.message : "No se pudieron cargar tus rollos") : null,
    refetch: query.refetch,
  };
}

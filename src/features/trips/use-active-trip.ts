import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { listTrips, type TripSummary } from "@/storage/trips";

/**
 * El viaje activo es el último que abriste (el primero de la lista guardada).
 * Se relee cada vez que la pantalla gana foco, así cambiarlo desde el selector
 * se ve al volver.
 */
export function useActiveTrip() {
  const [state, setState] = useState<{ trips: TripSummary[]; loaded: boolean }>({ trips: [], loaded: false });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listTrips().then((trips) => active && setState({ trips, loaded: true }));
      return () => {
        active = false;
      };
    }, []),
  );

  return { trip: state.trips[0] ?? null, trips: state.trips, loaded: state.loaded };
}

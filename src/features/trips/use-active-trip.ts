import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { listTrips, type TripSummary } from "@/storage/trips";

/**
 * The active trip is the last one you opened (the first of the saved list).
 * Re-read every time the screen gains focus, so changing it from the selector
 * shows up on return.
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

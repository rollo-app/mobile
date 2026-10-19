import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import type { TripDetail } from "./actions";
import { nextPhaseEdge, rollPhase, type RollPhase } from "./phase";

// setTimeout overflows past ~24.8 days: wait in chunks and re-check.
const MAX_WAIT = 2 ** 31 - 1;

/**
 * The roll's phase (`null` while the detail is unknown). Recomputed when the screen gains focus
 * and, while it stays open, right when the phase changes by the clock.
 */
export function useRollPhase(detail: TripDetail | null): RollPhase | null {
  const [now, setNow] = useState(() => Date.now());
  const trip = detail?.trip;

  useFocusEffect(
    useCallback(() => {
      if (!trip) return;
      setNow(Date.now());
      let timer: ReturnType<typeof setTimeout>;
      const arm = () => {
        const edge = nextPhaseEdge(trip, Date.now());
        if (edge === null) return;
        timer = setTimeout(() => {
          setNow(Date.now());
          arm();
        }, Math.min(Math.max(edge - Date.now(), 0) + 1, MAX_WAIT));
      };
      arm();
      return () => clearTimeout(timer);
    }, [trip]),
  );

  return trip ? rollPhase(trip, now) : null;
}

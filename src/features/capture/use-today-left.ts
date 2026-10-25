import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import type { TripDetail } from "@/features/trips/actions";
import { loadLeft } from "./load-left";

/**
 * Photos you have left on the trip (today's, or the whole rollo's with a total limit), discounting what is in the queue.
 * `null` while unknown. Recomputed when returning to the screen (e.g. when closing the camera).
 */
export function useTodayLeft(tripId: string | undefined, detail: TripDetail | null) {
  const [left, setLeft] = useState<{ photos: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!tripId || !detail) return;
      let active = true;
      loadLeft(detail, Date.now()).then((next) => active && setLeft(next));
      return () => {
        active = false;
      };
    }, [tripId, detail]),
  );

  return left;
}

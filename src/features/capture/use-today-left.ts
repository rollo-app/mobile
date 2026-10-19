import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import type { TripDetail } from "@/features/trips/actions";
import { localDay, remaining } from "./quota";
import { getQueue } from "./store";

/**
 * Photos and videos you have left today on the trip, discounting what is in the queue.
 * `null` while unknown. Recomputed when returning to the screen (e.g. when closing the camera).
 */
export function useTodayLeft(tripId: string | undefined, detail: TripDetail | null) {
  const [left, setLeft] = useState<{ photos: number; videos: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!tripId || !detail) return;
      let active = true;
      const day = localDay(Date.now(), detail.trip.timezone);
      getQueue()
        .then((queue) => queue.countPending(tripId, day))
        .then((pending) => active && setLeft(remaining(detail.today, day, pending)));
      return () => {
        active = false;
      };
    }, [tripId, detail]),
  );

  return left;
}

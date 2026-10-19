import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import type { TripDetail } from "@/features/trips/actions";
import { localDay, remaining } from "./quota";
import { getQueue } from "./store";

/**
 * Fotos y videos que te quedan hoy en el viaje, descontando lo que está en la cola.
 * `null` mientras no se sabe. Se recalcula al volver a la pantalla (por ej. al cerrar la cámara).
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

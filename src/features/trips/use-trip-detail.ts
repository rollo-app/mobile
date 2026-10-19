import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { fetchTrip, type TripDetail } from "./actions";

/**
 * Detalle de un viaje desde el server. Se vuelve a pedir cada vez que la pantalla
 * gana foco (por ejemplo al volver de cambiar tu nombre) y mientras tanto se
 * mantienen los datos que ya había. Al cambiar de viaje se descarta lo anterior.
 */
export function useTripDetail(tripId: string | undefined) {
  const [state, setState] = useState<{ detail: TripDetail | null; error: string | null }>({ detail: null, error: null });
  const loadedFor = useRef<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      if (!tripId) return;
      let active = true;
      if (loadedFor.current !== tripId) {
        loadedFor.current = tripId;
        setState({ detail: null, error: null });
      }
      fetchTrip(tripId)
        .then((detail) => active && setState({ detail, error: null }))
        .catch(
          (e: unknown) =>
            active &&
            setState((prev) => ({ detail: prev.detail, error: e instanceof Error ? e.message : "No se pudo cargar el viaje" })),
        );
      return () => {
        active = false;
      };
    }, [tripId]),
  );

  return state;
}

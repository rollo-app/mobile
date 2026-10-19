import { useEffect, useState } from "react";
import { fetchTrip, type TripDetail } from "./actions";

/** Detalle de un viaje desde el server. Al cambiar de viaje se descarta lo anterior. */
export function useTripDetail(tripId: string | undefined) {
  const [state, setState] = useState<{ detail: TripDetail | null; error: string | null }>({ detail: null, error: null });

  useEffect(() => {
    if (!tripId) return;
    let active = true;
    setState({ detail: null, error: null });
    fetchTrip(tripId)
      .then((detail) => active && setState({ detail, error: null }))
      .catch(
        (e: unknown) =>
          active && setState({ detail: null, error: e instanceof Error ? e.message : "No se pudo cargar el viaje" }),
      );
    return () => {
      active = false;
    };
  }, [tripId]);

  return state;
}

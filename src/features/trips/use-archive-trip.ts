import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { setTripArchived } from "./actions";
import type { TripSummary } from "./active";
import { myTripsKey } from "./use-active-trip";

type Vars = { tripId: string; archived: boolean };

/**
 * Archives or unarchives a revealed roll for you. Optimistic over the list of rolls (it moves between
 * sections right away); on failure the previous list comes back and a native alert says so. The active roll stays.
 */
export function useArchiveTrip() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ tripId, archived }: Vars) => setTripArchived(tripId, archived),
    onMutate: async ({ tripId, archived }) => {
      // A refetch landing mid-request would overwrite the optimistic value.
      await client.cancelQueries({ queryKey: myTripsKey });
      const previous = client.getQueryData<{ trips: TripSummary[] }>(myTripsKey);
      client.setQueryData<{ trips: TripSummary[] }>(myTripsKey, (data) =>
        data ? { ...data, trips: data.trips.map((t) => (t.id === tripId ? { ...t, archived } : t)) } : data,
      );
      return { previous };
    },
    onError: (_error, { archived }, context) => {
      if (context?.previous) client.setQueryData(myTripsKey, context.previous);
      Burnt.alert({
        preset: "error",
        title: archived ? "No se pudo archivar" : "No se pudo desarchivar",
        message: "Probá de nuevo cuando tengas señal.",
      });
    },
  });

  return { setArchived: (tripId: string, archived: boolean) => mutation.mutate({ tripId, archived }) };
}

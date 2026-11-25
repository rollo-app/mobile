import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTrip } from "./actions";
import { myTripsKey } from "./use-active-trip";
import { tripKey } from "./use-trip-detail";

/** Saves which vertical part (0 = top … 1 = bottom) of the cover the Rollos list shows; refreshes the detail and your list. */
export function useUpdateCoverFocus(tripId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (coverFocusY: number) => updateTrip(tripId, { coverFocusY }),
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: tripKey(tripId) }), client.invalidateQueries({ queryKey: myTripsKey })]),
  });
}

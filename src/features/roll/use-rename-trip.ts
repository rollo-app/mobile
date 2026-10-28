import { useMutation, useQueryClient } from "@tanstack/react-query";
import { renameTrip } from "@/features/trips/actions";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { tripKey } from "@/features/trips/use-trip-detail";

export const MAX_TRIP_NAME = 60;

/** The name to send, or null when there's nothing to send (empty after trimming, too long, or unchanged). */
export function nextTripName(input: string, current: string): string | null {
  const name = input.trim();
  return name.length === 0 || name.length > MAX_TRIP_NAME || name === current ? null : name;
}

/** Renames the rollo; refreshes its detail and your list (the name shows there too). */
export function useRenameTrip(tripId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => renameTrip(tripId, name),
    onSuccess: () =>
      Promise.all([client.invalidateQueries({ queryKey: tripKey(tripId) }), client.invalidateQueries({ queryKey: myTripsKey })]),
  });
}

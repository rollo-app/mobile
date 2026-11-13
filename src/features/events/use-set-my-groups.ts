import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setMyGroups } from "@/features/trips/actions";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { feedKey } from "@/features/trips/use-feed";
import { tripKey } from "@/features/trips/use-trip-detail";

/** Saves the groups you are in; refreshes the detail (your groups) and your list (the cover of "Tus rollos" follows them). */
export function useSetMyGroups(tripId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (groupIds: string[]) => setMyGroups(tripId, groupIds),
    onSuccess: () =>
      Promise.all([
      client.invalidateQueries({ queryKey: tripKey(tripId) }), client.invalidateQueries({ queryKey: myTripsKey }),
      // Groups decide which photos a guest sees (prefix of both the asc and desc caches).
      client.invalidateQueries({ queryKey: feedKey(tripId) }),
    ]),
  });
}

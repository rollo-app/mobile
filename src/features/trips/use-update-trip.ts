import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncMoments } from "@/features/moments/moment-sync";
import { updateTrip } from "./actions";
import type { UpdateTripBody } from "./edit-form";
import { myTripsKey } from "./use-active-trip";
import { tripKey } from "./use-trip-detail";

const MOMENT_FIELDS = ["startsAt", "endsAt", "momentMode", "momentWindowStart", "momentWindowEnd"] as const;

/** Saves the changed settings; refreshes the detail and your list, and replans the daily moments when dates or moment changed. */
export function useUpdateTrip(tripId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateTripBody) => updateTrip(tripId, body),
    onSuccess: (_trip, body) => {
      if (MOMENT_FIELDS.some((field) => field in body)) void syncMoments();
      return Promise.all([client.invalidateQueries({ queryKey: tripKey(tripId) }), client.invalidateQueries({ queryKey: myTripsKey })]);
    },
  });
}

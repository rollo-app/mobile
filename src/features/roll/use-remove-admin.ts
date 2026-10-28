import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeAdmin } from "@/features/trips/actions";
import { tripKey } from "@/features/trips/use-trip-detail";

/** Takes admin away from a member (creator only); refreshes the rollo's detail. */
export function useRemoveAdmin(tripId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => removeAdmin(tripId, memberId),
    onSuccess: () => client.invalidateQueries({ queryKey: tripKey(tripId) }),
  });
}

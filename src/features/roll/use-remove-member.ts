import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeMember } from "@/features/trips/actions";
import { tripKey } from "@/features/trips/use-trip-detail";

/** Removes a member from the rollo; refreshes the rollo's detail. */
export function useRemoveMember(tripId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => removeMember(tripId, memberId),
    onSuccess: () => client.invalidateQueries({ queryKey: tripKey(tripId) }),
  });
}

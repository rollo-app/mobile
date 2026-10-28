import { useMutation, useQueryClient } from "@tanstack/react-query";
import { makeAdmin } from "@/features/trips/actions";
import { tripKey } from "@/features/trips/use-trip-detail";

/** Makes a member an admin; refreshes the rollo's detail. */
export function useMakeAdmin(tripId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => makeAdmin(tripId, memberId),
    onSuccess: () => client.invalidateQueries({ queryKey: tripKey(tripId) }),
  });
}

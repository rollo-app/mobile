import { useMutation, useQueryClient } from "@tanstack/react-query";
import { joinTrip } from "./actions";
import { myTripsKey } from "./use-active-trip";

export function useJoinTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) => joinTrip(input),
    // Returning the promise makes the mutation wait for the refetch.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myTripsKey }),
  });
}

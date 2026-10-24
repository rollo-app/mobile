import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTrip } from "./actions";
import { myTripsKey } from "./use-active-trip";

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createTrip>[0]) => createTrip(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myTripsKey }),
  });
}

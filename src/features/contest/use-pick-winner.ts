import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { errorMessage } from "@/api/client";
import { putWinner } from "./actions";
import { contestKey } from "./use-contest";

/** Breaks a tie (organizers): the server closes the contest with that photo, so the contest is read again. */
export function usePickWinner(tripId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (mediaId: string) => putWinner(tripId, mediaId),
    onSuccess: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    onSettled: () => client.invalidateQueries({ queryKey: contestKey(tripId) }),
  });
  return {
    pick: mutation.mutate,
    picking: mutation.isPending,
    error: errorMessage(mutation.error, "No se pudo elegir la ganadora"),
  };
}

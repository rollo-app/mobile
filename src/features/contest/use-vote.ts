import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { errorMessage } from "@/api/client";
import { deleteVote, putVote, type Contest } from "./actions";
import { contestKey } from "./use-contest";

/**
 * Votes for a finalist, or takes the vote back with `null`. Optimistic on `["contest", tripId]`; if the server refuses
 * (own photo, voting closed) the previous vote comes back and the server's message is in `error`.
 */
export function useVote(tripId: string) {
  const client = useQueryClient();
  const key = contestKey(tripId);

  const mutation = useMutation({
    mutationFn: (mediaId: string | null) => (mediaId ? putVote(tripId, mediaId) : deleteVote(tripId)),
    onMutate: async (mediaId) => {
      void Haptics.selectionAsync();
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Contest>(key);
      if (previous) client.setQueryData<Contest>(key, { ...previous, myVote: mediaId });
      return { previous };
    },
    onError: (_error, _mediaId, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });

  return {
    vote: mutation.mutate,
    error: errorMessage(mutation.error, "No se pudo guardar el voto"),
    clearError: mutation.reset,
  };
}

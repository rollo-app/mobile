import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { errorMessage } from "@/api/client";
import { deleteFinalist, putFinalist, type Contest, type ContestFinalist } from "./actions";
import { contestKey } from "./use-contest";

/** Picking needs the finalist's data to show it right away; dropping only needs the id. */
type Target = { add: true; finalist: ContestFinalist } | { add: false; mediaId: string };

/**
 * Marks or unmarks a finalist. Optimistic on `["contest", tripId]`; if the server refuses (outside the window)
 * the previous list comes back and the server's message is in `error`.
 */
export function useToggleFinalist(tripId: string) {
  const client = useQueryClient();
  const key = contestKey(tripId);

  const mutation = useMutation({
    mutationFn: (target: Target) => (target.add ? putFinalist(tripId, target.finalist.mediaId) : deleteFinalist(tripId, target.mediaId)),
    onMutate: async (target) => {
      void Haptics.selectionAsync();
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Contest>(key);
      if (previous) {
        const without = previous.finalists.filter((f) => f.mediaId !== (target.add ? target.finalist.mediaId : target.mediaId));
        client.setQueryData<Contest>(key, { ...previous, finalists: target.add ? [...without, target.finalist] : without });
      }
      return { previous };
    },
    onError: (_error, _target, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });

  return {
    toggle: mutation.mutate,
    error: errorMessage(mutation.error, "No se pudo cambiar la finalista"),
    clearError: mutation.reset,
  };
}

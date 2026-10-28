import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { errorMessage } from "@/api/client";
import { feedKey } from "@/features/trips/use-feed";
import { blockFeature, unblockFeature } from "./actions";

type Vars = { mediaId: string; tripId: string; blocked: boolean };

/**
 * Author only: stops (or allows again) others featuring one of your photos. Refetches the roll's feed on success
 * (the server also removes it from other profiles); `blocking` stays true until that refetch ends.
 * A second call while one is pending is ignored.
 */
export function useBlockFeature() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ mediaId, blocked }: Vars) => (blocked ? blockFeature : unblockFeature)(mediaId),
    onSuccess: (_data, { tripId }) => client.invalidateQueries({ queryKey: feedKey(tripId) }),
  });
  const { mutateAsync, reset, isPending } = mutation;

  const setBlocked = useCallback(
    async (mediaId: string, tripId: string, blocked: boolean) => {
      if (isPending) return;
      await mutateAsync({ mediaId, tripId, blocked }).catch(() => undefined);
    },
    [isPending, mutateAsync],
  );

  return { setBlocked, blocking: isPending, error: errorMessage(mutation.error, "No se pudo cambiar"), reset };
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { errorMessage } from "@/api/client";
import { featuredByKey } from "@/features/activity/use-featured-by";
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
    onSuccess: (_data, { tripId }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: feedKey(tripId) }),
        // Blocking takes the photo off other profiles, so it leaves "Destacaron tus fotos".
        client.invalidateQueries({ queryKey: featuredByKey }),
      ]),
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

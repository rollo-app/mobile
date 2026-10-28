import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { errorMessage } from "@/api/client";
import { unfeatureMedia, type FeaturedPhoto } from "./actions";
import { featuredKey } from "./use-featured";

const UNFEATURE_KEY = ["unfeature-photo"];

/**
 * Takes one of your featured photos off your profile. On success it leaves the cached list and the roll feeds
 * (which mark featured photos) are refetched; `error` says which photo failed. A second call while one is
 * pending is ignored.
 */
export function useUnfeaturePhoto(userId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: UNFEATURE_KEY,
    mutationFn: (mediaId: string) => unfeatureMedia(mediaId),
    onSuccess: (_data, mediaId) => {
      client.setQueryData<FeaturedPhoto[]>(featuredKey(userId), (list) => list?.filter((p) => p.mediaId !== mediaId));
      // The roll galleries mark the photo as featured: they refetch.
      void client.invalidateQueries({ queryKey: ["feed"] });
    },
  });
  const { mutate } = mutation;

  // Checks the cache, not `isPending`: that only flips on the next render, after a fast second tap.
  const unfeature = useCallback(
    (mediaId: string, onSuccess?: () => void) => {
      if (client.getMutationCache().findAll({ mutationKey: UNFEATURE_KEY, status: "pending" }).length > 0) return;
      mutate(mediaId, { onSuccess: onSuccess && (() => onSuccess()) });
    },
    [client, mutate],
  );

  const message = errorMessage(mutation.error, "No se pudo sacar de tu perfil");
  return {
    unfeature,
    removing: mutation.isPending,
    error: message && mutation.variables ? { mediaId: mutation.variables, message } : null,
  };
}

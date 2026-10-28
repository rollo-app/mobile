import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo } from "react";
import { errorMessage } from "@/api/client";
import { myLikesKey } from "@/features/activity/use-my-likes";
import { likeMedia, unlikeMedia } from "./actions";
import { cancelLikeRefetches, setLikedInCaches } from "./like-cache";

const TOGGLE_KEY = ["toggle-like"];
type Target = { id: string; likedByMe: boolean };

/**
 * Likes or unlikes a photo. Optimistic over every cached feed and featured list that has it; on failure
 * it puts the previous value back and exposes the server's message in `error` (with the photo it was for).
 * Liking gives a light haptic. A second toggle of the same photo while the first is pending is ignored.
 */
export function useToggleLike() {
  const client = useQueryClient();

  const mutation = useMutation({
    mutationKey: TOGGLE_KEY,
    mutationFn: (photo: Target) => (photo.likedByMe ? unlikeMedia : likeMedia)(photo.id),
    onMutate: async (photo) => {
      if (!photo.likedByMe) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await cancelLikeRefetches(client);
      setLikedInCaches(client, photo.id, !photo.likedByMe);
    },
    onError: (_error, photo) => setLikedInCaches(client, photo.id, photo.likedByMe),
    // Tu actividad → Me gusta lists what you like: refetch it, the server decides what is still there.
    onSettled: () => client.invalidateQueries({ queryKey: myLikesKey }),
  });
  const { mutateAsync } = mutation;

  const pendingIds = useMutationState({
    filters: { mutationKey: TOGGLE_KEY, status: "pending" },
    select: (m) => (m.state.variables as Target).id,
  });
  const pending = useMemo(() => new Set(pendingIds), [pendingIds]);

  const toggle = useCallback(
    async (photo: Target) => {
      const busy = client.getMutationCache().findAll({
        mutationKey: TOGGLE_KEY,
        status: "pending",
        predicate: (m) => (m.state.variables as Target).id === photo.id,
      });
      if (busy.length > 0) return;
      await mutateAsync(photo).catch(() => undefined);
    },
    [client, mutateAsync],
  );

  const error = mutation.error
    ? { mediaId: mutation.variables?.id ?? "", message: errorMessage(mutation.error, "No se pudo cambiar el me gusta") ?? "" }
    : null;

  /** Double tap: likes, never takes a like away. */
  const like = useCallback(async (photo: Target) => {
    if (!photo.likedByMe) await toggle(photo);
  }, [toggle]);

  return { toggle, like, pending, error };
}

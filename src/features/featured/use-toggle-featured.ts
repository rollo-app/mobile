import * as Haptics from "expo-haptics";
import { useMutation, useMutationState, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { errorMessage } from "@/api/client";
import { useMe } from "@/features/auth/use-me";
import type { Feed } from "@/features/trips/actions";
import { feedKey } from "@/features/trips/use-feed";
import { showPill } from "@/ui/pill";
import { featureMedia, unfeatureMedia } from "./actions";
import { featuredKey } from "./use-featured";

const TOGGLE_KEY = ["toggle-featured"];
type Vars = { photo: { id: string; featuredByMe: boolean }; tripId: string };

function setFeaturedInFeed(client: QueryClient, tripId: string, mediaId: string, featuredByMe: boolean) {
  client.setQueryData<Feed>(feedKey(tripId), (feed) =>
    feed ? { ...feed, items: feed.items.map((item) => (item.id === mediaId ? { ...item, featuredByMe } : item)) } : feed,
  );
}

/**
 * Features or unfeatures a revealed photo on your profile. Optimistic over the roll's feed cache;
 * on failure it puts the previous value back and exposes the server's message in `error`.
 * A second toggle of the same photo while the first is pending is ignored.
 */
export function useToggleFeatured() {
  const client = useQueryClient();
  const { me } = useMe();

  const mutation = useMutation({
    mutationKey: TOGGLE_KEY,
    mutationFn: ({ photo }: Vars) => (photo.featuredByMe ? unfeatureMedia : featureMedia)(photo.id),
    onMutate: async ({ photo, tripId }) => {
      // A refetch landing mid-request would overwrite the optimistic value.
      await client.cancelQueries({ queryKey: feedKey(tripId) });
      setFeaturedInFeed(client, tripId, photo.id, !photo.featuredByMe);
    },
    onError: (_error, { photo, tripId }) => setFeaturedInFeed(client, tripId, photo.id, photo.featuredByMe),
    onSuccess: (_data, { photo }) => {
      if (me) void client.invalidateQueries({ queryKey: featuredKey(me.id) });
      if (!photo.featuredByMe) {
        showPill("Destacada en tu perfil");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });
  const { mutateAsync } = mutation;

  const pendingIds = useMutationState({
    filters: { mutationKey: TOGGLE_KEY, status: "pending" },
    select: (m) => (m.state.variables as Vars).photo.id,
  });
  const pending = useMemo(() => new Set(pendingIds), [pendingIds]);

  const toggle = useCallback(
    async (photo: { id: string; featuredByMe: boolean }, tripId: string) => {
      const busy = client.getMutationCache().findAll({
        mutationKey: TOGGLE_KEY,
        status: "pending",
        predicate: (m) => (m.state.variables as Vars).photo.id === photo.id,
      });
      if (busy.length > 0) return;
      await mutateAsync({ photo, tripId }).catch(() => undefined);
    },
    [client, mutateAsync],
  );

  return { toggle, pending, error: errorMessage(mutation.error, "No se pudo cambiar la foto destacada") };
}

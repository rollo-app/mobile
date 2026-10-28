import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { useCallback } from "react";
import { featuredByKey } from "@/features/activity/use-featured-by";
import type { Feed } from "@/features/trips/actions";
import { feedKey } from "@/features/trips/use-feed";
import { archiveMedia, unarchiveMedia } from "./actions";

type Vars = { mediaId: string; tripId: string; archived: boolean };

/** Archiving also takes it off every profile (the server deletes those rows), so it is no longer featured by you either. */
function setArchivedInFeed(client: QueryClient, tripId: string, mediaId: string, archived: boolean) {
  client.setQueryData<Feed>(feedKey(tripId), (feed) =>
    feed
      ? {
          ...feed,
          items: feed.items.map((item) =>
            item.id === mediaId ? { ...item, archived, ...(archived && { featuredByMe: false }) } : item,
          ),
        }
      : feed,
  );
}

/**
 * Archives or unarchives your own revealed photo. Optimistic over the roll's feed cache (the server's answer is just
 * that, so the feed is not refetched); on failure it puts the previous feed back and says so with a native alert.
 */
export function useArchivePhoto() {
  const client = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: ({ mediaId, archived }: Vars) => (archived ? archiveMedia : unarchiveMedia)(mediaId),
    onMutate: async ({ mediaId, tripId, archived }) => {
      // A refetch landing mid-request would overwrite the optimistic value.
      await client.cancelQueries({ queryKey: feedKey(tripId) });
      const previous = client.getQueryData<Feed>(feedKey(tripId));
      setArchivedInFeed(client, tripId, mediaId, archived);
      return { previous };
    },
    onError: (_error, { tripId, archived }, context) => {
      if (context?.previous) client.setQueryData(feedKey(tripId), context.previous);
      Burnt.alert({
        preset: "error",
        title: archived ? "No se pudo archivar" : "No se pudo desarchivar",
        message: "Probá de nuevo cuando tengas señal.",
      });
    },
    // Profiles that featured it (yours or someone else's you looked at) lost it.
    onSuccess: (_data, { archived }) => {
      if (archived) {
        void client.invalidateQueries({ queryKey: ["featured"] });
        void client.invalidateQueries({ queryKey: featuredByKey });
      }
    },
  });

  return useCallback(
    (photo: { id: string }, tripId: string, archived: boolean) => mutate({ mediaId: photo.id, tripId, archived }),
    [mutate],
  );
}

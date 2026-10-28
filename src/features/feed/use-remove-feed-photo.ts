import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteMedia } from "@/features/trips/actions";
import { feedKey } from "@/features/trips/use-feed";
import { tripKey } from "@/features/trips/use-trip-detail";

type Vars = { mediaId: string; tripId: string };

/** The admin's delete of someone's photo from the feed: on success the roll's feed and detail are refetched. */
export function useRemoveFeedPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaId }: Vars) => deleteMedia(mediaId),
    onSuccess: async (_data, { tripId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: feedKey(tripId) }),
        queryClient.invalidateQueries({ queryKey: tripKey(tripId) }),
      ]);
    },
  });
}

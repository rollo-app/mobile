import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addComment } from "./actions";
import { commentsKey } from "./use-comments";

/** Comments on a photo, then refreshes its list and the feed (its count). */
export function useAddComment(mediaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => addComment(mediaId, text),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentsKey(mediaId) });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { myCommentsKey } from "@/features/activity/use-my-comments";
import { addComment } from "./actions";
import { bumpCommentCount } from "./comment-cache";
import { commentsKey } from "./use-comments";

/** Comments on a photo, then refreshes its list and moves its count in the cached feeds. */
export function useAddComment(mediaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => addComment(mediaId, text),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentsKey(mediaId) });
      void queryClient.invalidateQueries({ queryKey: myCommentsKey });
      bumpCommentCount(queryClient, mediaId, 1);
    },
  });
}

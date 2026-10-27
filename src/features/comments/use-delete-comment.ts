import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteComment } from "./actions";
import { bumpCommentCount } from "./comment-cache";
import { commentsKey } from "./use-comments";

/** Deletes a comment, then refreshes the photo's list and moves its count in the cached feeds. */
export function useDeleteComment(mediaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentsKey(mediaId) });
      bumpCommentCount(queryClient, mediaId, -1);
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteComment } from "./actions";
import { commentsKey } from "./use-comments";

/** Deletes a comment, then refreshes the photo's list and the feed (its count). */
export function useDeleteComment(mediaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentsKey(mediaId) });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

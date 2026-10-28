import { unwrap, type Schemas } from "@/api/client";
import { authedClient } from "@/features/auth/session";

export type Comment = Schemas["Comment"];

/** The comments you see on a photo of a revealed roll, oldest first. 404 if you can't see the photo. */
export async function fetchComments(mediaId: string): Promise<Comment[]> {
  return (await unwrap((await authedClient()).GET("/media/{mediaId}/comments", { params: { path: { mediaId } } }))).comments;
}

/** Comments on a photo; the server notifies its author and whoever commented before. */
export async function addComment(mediaId: string, text: string): Promise<Comment> {
  return unwrap((await authedClient()).POST("/media/{mediaId}/comments", { params: { path: { mediaId } }, body: { text } }));
}

/** Deletes a comment you wrote, or any comment on your photo. */
export async function deleteComment(commentId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/comments/{commentId}", { params: { path: { commentId } } }));
}

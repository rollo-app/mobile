import { unwrap } from "@/api/client";
import { authedClient } from "@/features/auth/session";

/** Likes a photo (idempotent). 404 if you can't see it; the server notifies its author. */
export async function likeMedia(mediaId: string): Promise<void> {
  await unwrap((await authedClient()).PUT("/media/{mediaId}/like", { params: { path: { mediaId } } }));
}

/** Removes your like from a photo (idempotent). */
export async function unlikeMedia(mediaId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/media/{mediaId}/like", { params: { path: { mediaId } } }));
}

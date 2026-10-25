import { unwrap } from "@/api/client";
import { authedClient } from "@/features/auth/session";

/** Archives your own photo of a revealed roll: only you keep seeing it (idempotent). It leaves every profile that featured it. */
export async function archiveMedia(mediaId: string): Promise<void> {
  await unwrap((await authedClient()).POST("/media/{mediaId}/archive", { params: { path: { mediaId } } }));
}

/** Shows your archived photo to everyone again (idempotent). It is not featured again anywhere. */
export async function unarchiveMedia(mediaId: string): Promise<void> {
  await unwrap((await authedClient()).POST("/media/{mediaId}/unarchive", { params: { path: { mediaId } } }));
}

/** Deletes your own photo of a revealed roll for good, for everyone (with its likes, comments and featured spots). */
export async function deleteMedia(mediaId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/media/{mediaId}", { params: { path: { mediaId } } }));
}

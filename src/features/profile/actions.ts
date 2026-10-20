import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { ApiError, unwrap } from "@/api/client";
import { authedClient } from "@/features/auth/session";
import type { User } from "@/features/auth/actions";

const AVATAR_MAX = 512;

export async function updateName(name: string): Promise<User> {
  return unwrap((await authedClient()).PATCH("/me", { body: { name: name.trim() } }));
}

/** The square the picker cropped, at most 512 px, as a JPEG (the server accepts up to 2 MB). */
async function resizeAvatar(photo: { uri: string; width: number; height: number }): Promise<string> {
  const ctx = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > AVATAR_MAX) ctx.resize({ width: AVATAR_MAX });
  const image = await ctx.renderAsync();
  return (await image.saveAsync({ compress: 0.85, format: SaveFormat.JPEG })).uri;
}

/** Profile photo: resize → signed URL → PUT → complete. Returns the updated user. */
export async function uploadAvatar(photo: { uri: string; width: number; height: number }): Promise<User> {
  const resized = await resizeAvatar(photo);
  const api = await authedClient();
  const { upload } = await unwrap(api.POST("/me/avatar"));

  let status = 0;
  try {
    status = (await new File(resized).upload(upload, { httpMethod: "PUT", headers: { "Content-Type": "image/jpeg" } })).status;
  } catch {
    // No connection: the same message as a rejected upload.
  }
  if (status < 200 || status >= 300) throw new ApiError(status, "No se pudo subir la foto. Probá de nuevo.");

  return unwrap(api.POST("/me/avatar/complete"));
}

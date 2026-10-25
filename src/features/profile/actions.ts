import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { ApiError, unwrap, type Schemas } from "@/api/client";
import { authedClient } from "@/features/auth/session";
import type { User } from "@/features/auth/actions";
import { normalizeUsername } from "./username";

const AVATAR_MAX = 512;
/** The server's cap; the upload URL is signed for the JPEG's exact size. */
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export type UserProfile = Schemas["UserProfile"];
export type ProfileVisibility = Schemas["ProfileVisibility"];
export type UserFriends = Schemas["UserFriends"];
export type UserFriend = Schemas["UserFriend"];

/**
 * Saves only the fields given: name (trimmed), username (normalized), description (the server trims
 * it; empty clears it) and who sees your profile.
 */
export async function updateProfile({
  name,
  username,
  bio,
  profileVisibility,
}: {
  name?: string;
  username?: string;
  bio?: string;
  profileVisibility?: ProfileVisibility;
}): Promise<User> {
  const body = {
    ...(name === undefined ? {} : { name: name.trim() }),
    ...(username === undefined ? {} : { username: normalizeUsername(username) }),
    ...(bio === undefined ? {} : { bio }),
    ...(profileVisibility === undefined ? {} : { profileVisibility }),
  };
  return unwrap((await authedClient()).PATCH("/me", { body }));
}

/** Someone's public profile (bio and friend count always); `canSee` says whether their featured photos and full friend list are visible to you. */
export async function fetchUser(userId: string): Promise<UserProfile> {
  return unwrap((await authedClient()).GET("/users/{userId}", { params: { path: { userId } } }));
}

/** Someone's friends: all of them if you may see their profile (`scope: "all"`), else only the ones in common. */
export async function fetchUserFriends(userId: string): Promise<UserFriends> {
  return unwrap((await authedClient()).GET("/users/{userId}/friends", { params: { path: { userId } } }));
}

/** Is this username free? (Your own counts as available.) The server normalizes it. */
export async function checkUsername(username: string): Promise<{ available: boolean; username: string }> {
  const api = await authedClient();
  return unwrap(api.GET("/usernames/{username}", { params: { path: { username: normalizeUsername(username) } } }));
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
  const file = new File(await resizeAvatar(photo));
  const sizeBytes = file.size ?? 0;
  if (sizeBytes > AVATAR_MAX_BYTES) throw new ApiError(400, "La foto es muy pesada. Probá con otra.");
  const api = await authedClient();
  const { upload } = await unwrap(api.POST("/me/avatar", { body: { sizeBytes } }));

  let status = 0;
  try {
    status = (await file.upload(upload, { httpMethod: "PUT", headers: { "Content-Type": "image/jpeg" } })).status;
  } catch {
    // No connection: the same message as a rejected upload.
  }
  if (status < 200 || status >= 300) throw new ApiError(status, "No se pudo subir la foto. Probá de nuevo.");

  return unwrap(api.POST("/me/avatar/complete"));
}

import type { Href } from "expo-router";
import type { LikedPhoto } from "./actions";

/** The viewer for a liked photo: the roll's gallery if you are in it, else the featured viewer of the profile that shows it. */
export function likeHref(photo: LikedPhoto): Href {
  return photo.source.kind === "trip"
    ? `/photo/${photo.mediaId}?tripId=${photo.source.tripId}`
    : `/featured/${photo.source.userId}/${photo.mediaId}`;
}

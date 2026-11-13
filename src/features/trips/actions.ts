import type { InfiniteData } from "@tanstack/react-query";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { ApiError, createApiClient, unwrap, type Schemas } from "@/api/client";
import { API_URL } from "@/config";
import { authedClient } from "@/features/auth/session";
import { setActiveTripId } from "@/storage/active-trip";
import type { TripSummary } from "./active";
import type { UpdateTripBody } from "./edit-form";

export type Trip = Schemas["Trip"];
export type TripDetail = Schemas["TripDetail"];
export type Feed = Schemas["Feed"];
export type EventPreview = Schemas["EventPreview"];

/** How many photos each person can take: that many per day, or that many in the whole rollo. */
export type PhotoLimit = { mode: "daily"; perDay: number } | { mode: "total"; total: number };

/** The trips you're in, most recent first. */
export async function fetchMyTrips(): Promise<{ trips: TripSummary[] }> {
  return unwrap((await authedClient()).GET("/me/trips"));
}

/** Creates a trip with the dates and daily limits the admin chose; it becomes the active one. */
export async function createTrip(input: {
  name: string;
  startsAt: number;
  endsAt: number;
  revealAt: number;
  photoLimit: PhotoLimit;
  timezone: string;
  /** Private rollo: no photo of it goes to a profile. Left out when off. */
  featuringDisabled?: boolean;
  momentMode?: "off" | "photo" | "photo_selfie";
  /** Minutes from midnight in `timezone`. */
  momentWindowStart?: number;
  momentWindowEnd?: number;
}): Promise<Trip> {
  const { photoLimit, ...rest } = input;
  const limit =
    photoLimit.mode === "total"
      ? { photoLimitMode: "total" as const, totalPhotoLimit: photoLimit.total }
      : { photoLimitMode: "daily" as const, dailyPhotoLimit: photoLimit.perDay };
  const created = await unwrap(
    (await authedClient()).POST("/trips", { body: { ...rest, ...limit, name: input.name.trim() } }),
  );
  await setActiveTripId(created.trip.id);
  return created.trip;
}

/** What the code opens: the event's name, cover and groups; null if it's a regular trip (or doesn't exist). No session needed. */
export async function previewEvent(code: string): Promise<EventPreview | null> {
  try {
    return await unwrap(
      createApiClient({ baseUrl: API_URL }).GET("/events/{code}", { params: { path: { code: code.trim().toUpperCase() } } }),
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Joins with the code (also fine if you were already in); it becomes the active trip. An event needs the chosen `groupIds`. */
export async function joinTrip(input: { code: string; groupIds?: string[] }): Promise<Trip> {
  const joined = await unwrap(
    (await authedClient()).POST("/trips/join", {
      body: { code: input.code.trim().toUpperCase(), ...(input.groupIds ? { groupIds: input.groupIds } : {}) },
    }),
  );
  await setActiveTripId(joined.trip.id);
  return joined.trip;
}

export async function fetchTrip(tripId: string): Promise<TripDetail> {
  return unwrap((await authedClient()).GET("/trips/{tripId}", { params: { path: { tripId } } }));
}

/** The feed as the paged cache holds it: one entry per loaded page; `pageParams` are the cursors (the first is undefined). */
export type FeedPages = InfiniteData<Feed, string | undefined>;

/** How many feed items a request asks for when a screen scrolls (and for the first page of any screen: fast first paint). */
export const FEED_PAGE_SIZE = 30;
/** How many feed items a request asks for when the whole feed is needed anyway (the backend accepts up to 100): fewer requests per session. */
export const FEED_BULK_PAGE_SIZE = 100;

/** `asc`: oldest first (the default). `desc`: newest first. */
export type FeedOrder = "asc" | "desc";

/**
 * One page of what's been uploaded to the trip, oldest first unless `order` says "desc" (newest first; keep the same `order` across the pages of one walk). Before the reveal it only has metadata (author, time,
 * place, thumbhash). `nextCursor` is null on the last page. Always sends a `limit`: without one the server returns everything.
 */
export async function fetchFeedPage(
  tripId: string, { cursor, limit, order }: { cursor?: string; limit: number; order?: FeedOrder },
): Promise<Feed> {
  return unwrap(
    (await authedClient()).GET("/trips/{tripId}/feed", { params: { path: { tripId }, query: { limit, ...(cursor && { cursor }), ...(order && { order }) } } }),
  );
}

/** Every page of the feed, one after the other, in the shape the paged cache stores (for what needs it all, like the offline maps). */
export async function fetchWholeFeed(tripId: string): Promise<FeedPages> {
  const pages: Feed[] = [];
  const pageParams: (string | undefined)[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchFeedPage(tripId, { cursor, limit: FEED_BULK_PAGE_SIZE });
    pages.push(page);
    pageParams.push(cursor);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return { pages, pageParams };
}

/** Deletes a photo or video from the trip (admin only, before the reveal). */
export async function deleteMedia(mediaId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/media/{mediaId}", { params: { path: { mediaId } } }));
}

/** Archives or unarchives a revealed roll for you only (it moves to "Archivados" in your list). */
export async function setTripArchived(tripId: string, archived: boolean): Promise<void> {
  await unwrap((await authedClient()).PATCH("/trips/{tripId}/members/me", { params: { path: { tripId } }, body: { archived } }));
}

export type EventGroup = Schemas["EventGroup"];

/** Replaces the groups you are in, in an event (refused after the reveal). */
export async function setMyGroups(tripId: string, groupIds: string[]): Promise<string[]> {
  const mine = await unwrap(
    (await authedClient()).PUT("/trips/{tripId}/members/me/groups", { params: { path: { tripId } }, body: { groupIds } }),
  );
  return mine.groupIds;
}

/** Adds a group to an event (organizers only; the name is unique in the event). */
export async function createGroup(tripId: string, name: string): Promise<EventGroup> {
  return unwrap((await authedClient()).POST("/trips/{tripId}/groups", { params: { path: { tripId } }, body: { name: name.trim() } }));
}

export async function renameGroup(tripId: string, groupId: string, name: string): Promise<EventGroup> {
  return unwrap(
    (await authedClient()).PATCH("/trips/{tripId}/groups/{groupId}", { params: { path: { tripId, groupId } }, body: { name: name.trim() } }),
  );
}

/** Deletes a group; the server refuses (409) while it has people or photos. */
export async function deleteGroup(tripId: string, groupId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/trips/{tripId}/groups/{groupId}", { params: { path: { tripId, groupId } } }));
}

const COVER_WIDTH = 1600;
/** The server's cap; the upload URL is signed for the JPEG's exact size. */
const COVER_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Event cover: resize to 1600 px wide JPEG (this also bakes the EXIF rotation in; the server strips EXIF) → signed URL → PUT →
 * complete. Returns the cover's path.
 */
export async function uploadCover(tripId: string, photo: { uri: string; width: number; height: number }): Promise<string> {
  const ctx = ImageManipulator.manipulate(photo.uri);
  if (photo.width > COVER_WIDTH) ctx.resize({ width: COVER_WIDTH });
  const image = await ctx.renderAsync();
  const file = new File((await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG })).uri);
  const sizeBytes = file.size ?? 0;
  if (sizeBytes > COVER_MAX_BYTES) throw new ApiError(400, "La foto es muy pesada. Probá con otra.");
  const api = await authedClient();
  const { upload } = await unwrap(api.POST("/trips/{tripId}/cover", { params: { path: { tripId } }, body: { sizeBytes } }));

  let status = 0;
  try {
    status = (await file.upload(upload, { httpMethod: "PUT", headers: { "Content-Type": "image/jpeg" } })).status;
  } catch {
    // No connection: the same message as a rejected upload.
  }
  if (status < 200 || status >= 300) throw new ApiError(status, "No se pudo subir la foto. Probá de nuevo.");

  const { coverUrl } = await unwrap(api.POST("/trips/{tripId}/cover/complete", { params: { path: { tripId } } }));
  return coverUrl;
}

export type TripMember = TripDetail["members"][number];

/** Makes a member an admin (any admin can). */
export async function makeAdmin(tripId: string, memberId: string): Promise<TripMember> {
  return unwrap((await authedClient()).POST("/trips/{tripId}/members/{memberId}/admin", { params: { path: { tripId, memberId } } }));
}

/** Takes admin away from a member (only the creator can). */
export async function removeAdmin(tripId: string, memberId: string): Promise<TripMember> {
  return unwrap((await authedClient()).DELETE("/trips/{tripId}/members/{memberId}/admin", { params: { path: { tripId, memberId } } }));
}

/** Removes a member from the rollo (their photos stay; an admin can add them back). */
export async function removeMember(tripId: string, memberId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/trips/{tripId}/members/{memberId}", { params: { path: { tripId, memberId } } }));
}

/** Renames the rollo (any admin can). */
export async function renameTrip(tripId: string, name: string): Promise<Trip> {
  return (await unwrap((await authedClient()).PATCH("/trips/{tripId}", { params: { path: { tripId } }, body: { name } }))).trip;
}

/** Deletes the rollo for everyone, photos included (creator only). */
export async function deleteTrip(tripId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/trips/{tripId}", { params: { path: { tripId } } }));
}

/** Changes dates, quota or daily moment of the rollo (any admin; only the fields sent change). */
export async function updateTrip(tripId: string, body: UpdateTripBody): Promise<Trip> {
  return (await unwrap((await authedClient()).PATCH("/trips/{tripId}", { params: { path: { tripId } }, body }))).trip;
}

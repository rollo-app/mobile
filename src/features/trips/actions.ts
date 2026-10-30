import { unwrap, type Schemas } from "@/api/client";
import { authedClient } from "@/features/auth/session";
import { setActiveTripId } from "@/storage/active-trip";
import type { TripSummary } from "./active";
import type { UpdateTripBody } from "./edit-form";

export type Trip = Schemas["Trip"];
export type TripDetail = Schemas["TripDetail"];
export type Feed = Schemas["Feed"];

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

/** Joins with the code (also fine if you were already in); it becomes the active trip. */
export async function joinTrip(input: { code: string }): Promise<Trip> {
  const joined = await unwrap(
    (await authedClient()).POST("/trips/join", { body: { code: input.code.trim().toUpperCase() } }),
  );
  await setActiveTripId(joined.trip.id);
  return joined.trip;
}

export async function fetchTrip(tripId: string): Promise<TripDetail> {
  return unwrap((await authedClient()).GET("/trips/{tripId}", { params: { path: { tripId } } }));
}

/** Everything uploaded to the trip. Before the reveal it only has metadata (author, time, place, thumbhash). */
export async function fetchFeed(tripId: string): Promise<Schemas["Feed"]> {
  return unwrap((await authedClient()).GET("/trips/{tripId}/feed", { params: { path: { tripId } } }));
}

/** Deletes a photo or video from the trip (admin only, before the reveal). */
export async function deleteMedia(mediaId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/media/{mediaId}", { params: { path: { mediaId } } }));
}

/** Archives or unarchives a revealed roll for you only (it moves to "Archivados" in your list). */
export async function setTripArchived(tripId: string, archived: boolean): Promise<void> {
  await unwrap((await authedClient()).PATCH("/trips/{tripId}/members/me", { params: { path: { tripId } }, body: { archived } }));
}

export type TripMember = TripDetail["me"];

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

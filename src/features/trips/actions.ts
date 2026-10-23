import { unwrap, type Schemas } from "@/api/client";
import { authedClient } from "@/features/auth/session";
import { setActiveTripId } from "@/storage/active-trip";
import type { TripSummary } from "./active";

export type Trip = Schemas["Trip"];
export type TripDetail = Schemas["TripDetail"];
export type Feed = Schemas["Feed"];

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
  dailyPhotoLimit: number;
  dailyVideoLimit: number;
  timezone: string;
}): Promise<Trip> {
  const created = await unwrap(
    (await authedClient()).POST("/trips", { body: { ...input, name: input.name.trim() } }),
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

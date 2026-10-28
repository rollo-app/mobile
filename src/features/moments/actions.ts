import { unwrap } from "@/api/client";
import { authedClient } from "@/features/auth/session";

export type MyTripMoments = { tripId: string; tripName: string; momentMode: "photo" | "photo_selfie"; moments: { day: string; notifyAt: number }[] };

/**
 * The caller's moments in every rollo the server says has some to schedule (active member, moment on, not revealed,
 * inside the window), in one call. A rollo the server leaves out has nothing to schedule. Never read through
 * `useQuery`: the times must not reach the persisted cache, they only live in the system's notification scheduler.
 */
export async function fetchAllMyMoments(): Promise<MyTripMoments[]> {
  const { trips } = await unwrap((await authedClient()).GET("/me/moments"));
  return trips;
}

import { unwrap } from "@/api/client";
import { authedClient } from "@/features/auth/session";

/**
 * The caller's own moments of a trip. Never read through `useQuery`: the times must not reach the
 * persisted cache, they only live in the system's notification scheduler.
 */
export async function fetchMyMoments(tripId: string): Promise<{ day: string; notifyAt: number }[]> {
  const { moments } = await unwrap(
    (await authedClient()).GET("/trips/{tripId}/moments", { params: { path: { tripId } } }),
  );
  return moments;
}

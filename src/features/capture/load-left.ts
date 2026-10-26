import type { TripDetail } from "@/features/trips/actions";
import { localDay, pendingDayFor, remaining } from "./quota";
import { getQueue } from "./store";

/** Photos you have left on the trip (today's or the rollo's, by its limit mode), discounting what is in the queue; `null` if unknown. */
export async function loadLeft(detail: TripDetail, now: number): Promise<{ photos: number } | null> {
  const day = localDay(now, detail.trip.timezone);
  const pending = await (await getQueue()).countPending(detail.trip.id, pendingDayFor(detail.trip, day));
  return remaining(detail.today, day, pending);
}

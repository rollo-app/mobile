import type { Schemas } from "@/api/client";

export type TripSummary = Schemas["TripSummary"];

/**
 * The active trip is the last one the user opened (its id is saved on the phone). If there's none
 * saved, or it's no longer in the list, it's the first of the list: the server sends the most
 * recent first.
 */
export function pickActiveTrip(trips: TripSummary[], activeId: string | null): TripSummary | null {
  return trips.find((t) => t.id === activeId) ?? trips[0] ?? null;
}

import type { TripSummary } from "@/features/trips/active";
import type { CommonTrip } from "./actions";

/** Your rolls a friend can be added to: not revealed and not already shared with them, in your order. */
export function addableTrips(myTrips: TripSummary[], common: CommonTrip[]): TripSummary[] {
  const shared = new Set(common.map((t) => t.id));
  return myTrips.filter((t) => !t.revealed && !shared.has(t.id));
}

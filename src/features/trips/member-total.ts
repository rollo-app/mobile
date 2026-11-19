import type { TripDetail } from "./actions";

/**
 * How many people are in the rollo. `memberCount` is the server's total (in an event `members` only lists who you can see);
 * a detail from an older API or from the persisted cache before the update has no `memberCount`, so fall back to the list.
 */
export function memberTotal(detail: Pick<TripDetail, "members"> & { memberCount?: number }): number {
  return typeof detail.memberCount === "number" ? detail.memberCount : detail.members.length;
}

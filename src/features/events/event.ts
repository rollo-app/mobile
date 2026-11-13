import type { TripDetail } from "@/features/trips/actions";

type Group = { id: string; name: string };

/** True for an event (guests split into groups); false for a regular rollo. */
export const isEvent = (trip: { type?: "trip" | "event" }): boolean => trip.type === "event";

// A cache saved by 1.3 lacks `groups` / `me.groupIds`: read them through these so a missing list is empty.
const groupsOf = (detail: TripDetail): Group[] => detail.trip.groups ?? [];

/** Organizers are the admins of the event. */
export const isOrganizer = (detail: TripDetail): boolean => detail.me.role === "admin";

/** The event groups you're in (none for a regular rollo or an organizer without groups). */
export function allGroups(detail: TripDetail): Group[] {
  return groupsOf(detail);
}

export function myGroups(detail: TripDetail): Group[] {
  const mine = new Set(detail.me.groupIds ?? []);
  return groupsOf(detail).filter((g) => mine.has(g.id));
}

/** The groups a photo can be sent to: all of them for an organizer, only your own for a guest. */
export function sendableGroups(detail: TripDetail): Group[] {
  return isOrganizer(detail) ? groupsOf(detail) : myGroups(detail);
}

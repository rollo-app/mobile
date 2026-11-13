import type { TripDetail } from "@/features/trips/actions";

type Group = { id: string; name: string };

/** True for an event (guests split into groups); false for a regular rollo. */
export const isEvent = (trip: { type: "trip" | "event" }): boolean => trip.type === "event";

/** Organizers are the admins of the event. */
export const isOrganizer = (detail: TripDetail): boolean => detail.me.role === "admin";

/** The event groups you're in (none for a regular rollo or an organizer without groups). */
export function myGroups(detail: TripDetail): Group[] {
  const mine = new Set(detail.me.groupIds);
  return detail.trip.groups.filter((g) => mine.has(g.id));
}

/** The groups a photo can be sent to: all of them for an organizer, only your own for a guest. */
export function sendableGroups(detail: TripDetail): Group[] {
  return isOrganizer(detail) ? detail.trip.groups : myGroups(detail);
}

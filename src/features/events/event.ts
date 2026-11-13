import type { TripDetail } from "@/features/trips/actions";
import { dateFormatter } from "@/lib/intl";

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

/**
 * Which groups a photo in the Feed belongs to, for the viewer: the photo's groups among the ones they can see (all for an
 * organizer, their own for a guest), "Todos los grupos" when an organizer's photo went to every group. Null when there is
 * nothing to tell: a regular rollo, a guest in a single group (every photo they see is from it) or no known group.
 */
export function photoGroupLabel(detail: TripDetail, groupIds: readonly string[] | null | undefined): string | null {
  if (!isEvent(detail.trip)) return null;
  const visible = isOrganizer(detail) ? groupsOf(detail) : myGroups(detail);
  if (visible.length <= 1) return null;
  const ids = new Set(groupIds ?? []);
  const names = visible.filter((g) => ids.has(g.id)).map((g) => g.name);
  if (names.length === 0) return null;
  if (isOrganizer(detail) && names.length === visible.length) return "Todos los grupos";
  return names.join(", ");
}

/** The event's day for its cover ("12 de diciembre"), in the event's time zone. */
export function eventDay(startsAt: number, timeZone: string): string {
  return dateFormatter("es-AR", { timeZone, day: "numeric", month: "long" }).format(startsAt);
}

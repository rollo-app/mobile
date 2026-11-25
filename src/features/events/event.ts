import type { TripDetail } from "@/features/trips/actions";
import { dateFormatter } from "@/lib/intl";
import { memberTotal } from "@/features/trips/member-total";

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

/**
 * The line on the public join screen. The server sends the count from 5 people on and null below that ("be among the first");
 * a missing field (an older API) shows no line at all.
 */
export function joinedLine(memberCount: number | null | undefined): string | null {
  if (memberCount === undefined) return null;
  return memberCount === null ? "Sé de los primeros en unirte" : `${memberCount} personas ya se unieron`;
}

/** "1 persona" / "N personas". */
export function peopleLabel(n: number): string {
  return `${n} ${n === 1 ? "persona" : "personas"}`;
}

const part = (parts: Intl.DateTimeFormatPart[], type: "day" | "month") => parts.find((p) => p.type === type)?.value ?? "";

/** A trip's dates in its own zone: "3 al 8 de enero", "28 de dic al 3 de enero", "3 de enero" for a single day. */
export function tripDates(startsAt: number, endsAt: number, timeZone: string): string {
  const long = dateFormatter("es-AR", { timeZone, day: "numeric", month: "long" });
  const short = dateFormatter("es-AR", { timeZone, day: "numeric", month: "short" });
  const from = long.formatToParts(startsAt);
  const to = long.formatToParts(endsAt);
  const [fromDay, fromMonth, toDay, toMonth] = [part(from, "day"), part(from, "month"), part(to, "day"), part(to, "month")];
  if (fromMonth === toMonth) return fromDay === toDay ? `${toDay} de ${toMonth}` : `${fromDay} al ${toDay} de ${toMonth}`;
  const shortMonth = part(short.formatToParts(startsAt), "month").replace(/\.$/, "");
  return `${fromDay} de ${shortMonth} al ${toDay} de ${toMonth}`;
}

/** The dates line of a rollo's public preview: the event's day or the trip's dates, in the rollo's own zone. */
export function previewDates(preview: { type: "trip" | "event"; startsAt: number; endsAt: number; timezone: string }): string {
  return preview.type === "event" ? eventDay(preview.startsAt, preview.timezone) : tripDates(preview.startsAt, preview.endsAt, preview.timezone);
}

/** What the join screen says about a rollo or event that was already revealed (nobody can join it any more). */
export function revealedMessage(preview: { type: "trip" | "event" }): string {
  return preview.type === "event" ? "Este evento ya se reveló." : "Este rollo ya se reveló.";
}

/** The line under the name on a rollo's cover: the event's day or the trip's dates, then how many people are in. */
export function heroSubtitle(detail: TripDetail): string {
  const { trip } = detail;
  const when = isEvent(trip) ? eventDay(trip.startsAt, trip.timezone) : tripDates(trip.startsAt, trip.endsAt, trip.timezone);
  return `${when} · ${peopleLabel(memberTotal(detail))}`;
}

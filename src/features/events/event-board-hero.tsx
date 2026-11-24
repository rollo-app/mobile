import type { TripDetail } from "@/features/trips/actions";
import { eventDay, isEvent, peopleLabel } from "./event";
import { EventDescription } from "./event-description";
import { EventHero } from "./event-hero";
import { memberTotal } from "@/features/trips/member-total";

/** The top of an event's board: its cover large, with the name and the day. Nothing for a regular rollo or without a cover. */
export function EventBoardHero({ detail }: { detail: TripDetail }) {
  const { trip } = detail;
  if (!isEvent(trip)) return null;
  // Without a cover there is no hero: just the description, when there is one.
  if (!trip.coverUrl) return trip.description ? <EventDescription text={trip.description} /> : null;
  return (
    <EventHero
      name={trip.name}
      coverUrl={trip.coverUrl}
      caption={`${eventDay(trip.startsAt, trip.timezone)} · ${peopleLabel(memberTotal(detail))}`}
      description={trip.description}
    />
  );
}

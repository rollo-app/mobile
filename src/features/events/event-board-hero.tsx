import type { TripDetail } from "@/features/trips/actions";
import { eventDay, isEvent } from "./event";
import { EventHero } from "./event-hero";

/** The top of an event's board: its cover large, with the name and the day. Nothing for a regular rollo or without a cover. */
export function EventBoardHero({ detail }: { detail: TripDetail }) {
  const { trip } = detail;
  if (!isEvent(trip) || !trip.coverUrl) return null;
  return <EventHero name={trip.name} coverUrl={trip.coverUrl} caption={eventDay(trip.startsAt, trip.timezone)} aspectRatio={4 / 3} />;
}

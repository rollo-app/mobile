import type { TripDetail } from "@/features/trips/actions";
import { heroSubtitle } from "./event";
import { EventDescription } from "./event-description";
import { EventHero } from "./event-hero";

/** The top of a rollo's board: its cover large, with the name and the dates. Without a cover, just the description; with neither, nothing. */
export function EventBoardHero({ detail }: { detail: TripDetail }) {
  const { trip } = detail;
  // Without a cover there is no hero: just the description, when there is one.
  if (!trip.coverUrl) return trip.description ? <EventDescription text={trip.description} /> : null;
  return (
    <EventHero
      name={trip.name}
      coverUrl={trip.coverUrl}
      caption={heroSubtitle(detail)}
      description={trip.description}
    />
  );
}

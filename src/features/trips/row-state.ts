import type { TripSummary } from "./active";
import { daysUntil, rollPhase, startsIn } from "./phase";

export type TripRowState = {
  /** "live" while shooting, "revealed" once revealed; no badge before or between. */
  badge: "live" | "revealed" | null;
  subtitle: string;
  /** Appended to the row's accessibility label ("Sur, en vivo"). */
  stateLabel: string | null;
};

/** What a row of "Tus rollos" says about a trip at `now`, counting days in `timeZone`. */
export function tripRowState(trip: TripSummary, now: number, timeZone: string): TripRowState {
  const role = trip.isCreator ? "Lo creaste vos" : "Entraste con un código";
  switch (rollPhase(trip, now)) {
    case "active":
      return { badge: "live", subtitle: role, stateLabel: "en vivo" };
    case "revealed":
      return { badge: "revealed", subtitle: role, stateLabel: "revelado" };
    case "upcoming":
      return { badge: null, subtitle: `Empieza ${startsIn(trip.startsAt, now, timeZone)}`, stateLabel: null };
    case "ended":
      return { badge: null, subtitle: `Se revela ${daysUntil(trip.revealAt, now, timeZone)}`, stateLabel: null };
  }
}

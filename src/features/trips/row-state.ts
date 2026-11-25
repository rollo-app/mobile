import { dateFormatter } from "@/lib/intl";
import { localDay } from "@/features/capture/quota";
import type { TripSummary } from "./active";
import { daysUntil, rollPhase, startsIn } from "./phase";

export type TripRowState = {
  /** "live" while shooting, "revealed" once revealed; no badge before or between. */
  badge: "live" | "revealed" | null;
  subtitle: string;
  /** Appended to the row's accessibility label ("Sur, en vivo"). */
  stateLabel: string | null;
};

/** What a row of the Rollos list says about a trip at `now`, counting days in `timeZone`. */
export function tripRowState(trip: TripSummary, now: number, timeZone: string): TripRowState {
  const role = trip.isCreator ? "Lo creaste vos" : "Entraste con un código";
  switch (rollPhase(trip, now)) {
    case "active":
      return { badge: "live", subtitle: role, stateLabel: "en vivo" };
    case "revealed":
      return { badge: "revealed", subtitle: revealedSubtitle(trip, timeZone), stateLabel: "revelado" };
    case "upcoming":
      return { badge: null, subtitle: `Empieza ${startsIn(trip.startsAt, now, timeZone)}`, stateLabel: null };
    case "ended":
      return { badge: null, subtitle: `Se revela ${daysUntil(trip.revealAt, now, timeZone)}`, stateLabel: null };
  }
}

/** "2 de nov" in `timeZone`. */
function shortDate(ms: number, timeZone: string) {
  const day = dateFormatter("es-AR", { day: "numeric", timeZone }).format(ms);
  const month = dateFormatter("es-AR", { month: "short", timeZone }).format(ms).replace(".", "");
  return `${day} de ${month}`;
}

function revealedSubtitle(trip: TripSummary, timeZone: string) {
  const photos = trip.totalUploaded === 1 ? "1 foto" : `${trip.totalUploaded} fotos`;
  return `Se reveló el ${shortDate(trip.revealAt, timeZone)} · ${photos}`;
}

const DAY = 24 * 60 * 60 * 1000;

/** "Día 3 de 6": which day of the roll `now` is, counting calendar days in `timeZone`. */
export function liveDayLabel(trip: TripSummary, now: number, timeZone: string): string {
  const start = Date.parse(localDay(trip.startsAt, timeZone));
  const total = Math.max(1, Math.round((Date.parse(localDay(trip.endsAt, timeZone)) - start) / DAY) + 1);
  const day = Math.round((Date.parse(localDay(now, timeZone)) - start) / DAY) + 1;
  return `Día ${Math.min(Math.max(day, 1), total)} de ${total}`;
}

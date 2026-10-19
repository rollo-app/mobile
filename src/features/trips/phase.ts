import { localDay } from "@/features/capture/quota";

export type RollPhase = "upcoming" | "active" | "ended" | "revealed";

type PhaseTrip = { startsAt: number; endsAt: number; revealed: boolean };

const DAY = 24 * 60 * 60 * 1000;

/** Which stage the roll is in: shooting is only allowed in "active". */
export function rollPhase(trip: PhaseTrip, now: number): RollPhase {
  if (trip.revealed) return "revealed";
  if (now >= trip.endsAt) return "ended";
  if (now >= trip.startsAt) return "active";
  return "upcoming";
}

/** The next moment the phase changes by itself (the reveal comes from the server), or null. */
export function nextPhaseEdge(trip: PhaseTrip, now: number): number | null {
  const phase = rollPhase(trip, now);
  if (phase === "upcoming") return trip.startsAt;
  if (phase === "active") return trip.endsAt;
  return null;
}

export function formatDate(ms: number, timeZone: string) {
  return new Date(ms).toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone });
}

export function formatTime(ms: number, timeZone: string) {
  return new Date(ms).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone });
}

/** "hoy a las 19:00" / "mañana" / "en N días", counting calendar days in the trip's zone. */
export function startsIn(startsAt: number, now: number, timeZone: string) {
  const days = Math.round((Date.parse(localDay(startsAt, timeZone)) - Date.parse(localDay(now, timeZone))) / DAY);
  if (days <= 0) return `hoy a las ${formatTime(startsAt, timeZone)}`;
  return days === 1 ? "mañana" : `en ${days} días`;
}

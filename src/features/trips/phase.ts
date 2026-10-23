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

/** "29 oct, 19:00" in the trip's zone; "12 ene 2025, 10:00" when the year isn't the current one. */
export function formatDateTime(ms: number, now: number, timeZone: string) {
  const day = new Date(ms).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone });
  const year = localDay(ms, timeZone).slice(0, 4);
  const sameYear = year === localDay(now, timeZone).slice(0, 4);
  return `${day}${sameYear ? "" : ` ${year}`}, ${formatTime(ms, timeZone)}`;
}

/** "hoy" / "mañana" / "en N días", counting calendar days in the trip's zone. */
export function daysUntil(ms: number, now: number, timeZone: string) {
  const days = Math.round((Date.parse(localDay(ms, timeZone)) - Date.parse(localDay(now, timeZone))) / DAY);
  if (days <= 0) return "hoy";
  return days === 1 ? "mañana" : `en ${days} días`;
}

/**
 * A trip's dates as a range in `timeZone`: "3 ene", "3 – 10 nov", "28 oct – 4 nov", with the year
 * when the end isn't in the current one ("3 – 12 ene 2027", "28 dic 2026 – 4 ene 2027").
 */
export function formatDateRange(startsAt: number, endsAt: number, now: number, timeZone: string) {
  const [start, end] = [localDay(startsAt, timeZone), localDay(endsAt, timeZone)];
  const day = (ms: number) => new Date(ms).toLocaleDateString("es-AR", { day: "numeric", timeZone });
  const month = (ms: number) => new Date(ms).toLocaleDateString("es-AR", { month: "short", timeZone }).replace(".", "");
  const withYear = end.slice(0, 4) !== localDay(now, timeZone).slice(0, 4);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const yearOf = (d: string) => (withYear ? ` ${d.slice(0, 4)}` : "");
  const endText = `${day(endsAt)} ${month(endsAt)}${yearOf(end)}`;
  if (start === end) return endText;
  if (start.slice(0, 7) === end.slice(0, 7)) return `${day(startsAt)} – ${endText}`;
  return `${day(startsAt)} ${month(startsAt)}${sameYear ? "" : yearOf(start)} – ${endText}`;
}

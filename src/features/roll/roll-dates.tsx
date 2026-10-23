import type { TripDetail } from "@/features/trips/actions";
import { daysUntil, formatDateTime, startsIn, type RollPhase } from "@/features/trips/phase";
import { Row, Section } from "@/ui/components";

/** "Fechas": start, end and reveal of a roll, each with a note relative to now. Board and revealed roll share it. */
export function RollDates({ detail, phase }: { detail: TripDetail; phase: RollPhase | null }) {
  const { trip } = detail;
  const now = Date.now();
  const tz = trip.timezone;
  const at = (ms: number) => formatDateTime(ms, now, tz);
  const startNote = phase === "upcoming" ? startsIn(trip.startsAt, now, tz) : "Empezó";
  const endNote = phase === "ended" || phase === "revealed" ? "Terminó" : undefined;
  const revealNote = phase === "revealed" ? "Se reveló" : daysUntil(trip.revealAt, now, tz);

  return (
    <Section title="Fechas">
      <Row label="Empieza" value={at(trip.startsAt)} note={startNote} />
      <Row label="Termina" value={at(trip.endsAt)} note={endNote} />
      <Row label="Se revela" value={at(trip.revealAt)} note={revealNote} />
    </Section>
  );
}

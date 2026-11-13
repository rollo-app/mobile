import type { TripDetail } from "@/features/trips/actions";
import { daysUntil, formatDateTime, startsIn, type RollPhase } from "@/features/trips/phase";
import { Row, Section } from "@/ui/components";

/** The formatted dates of a roll and their notes relative to now; shared by "Fechas" and the board's reveal row. */
function dateParts(detail: TripDetail, phase: RollPhase | null) {
  const { trip } = detail;
  const now = Date.now();
  const tz = trip.timezone;
  const at = (ms: number) => formatDateTime(ms, now, tz);
  return {
    start: at(trip.startsAt),
    end: at(trip.endsAt),
    reveal: at(trip.revealAt),
    startNote: phase === "upcoming" ? startsIn(trip.startsAt, now, tz) : "Empezó",
    endNote: phase === "ended" || phase === "revealed" ? "Terminó" : undefined,
    revealNote: phase === "revealed" ? "Se reveló" : daysUntil(trip.revealAt, now, tz),
  };
}

/** "Fechas": start, end and reveal of a roll, each with a note relative to now. Lives in "Ajustes del rollo". */
export function RollDates({ detail, phase }: { detail: TripDetail; phase: RollPhase | null }) {
  const { trip } = detail;
  const d = dateParts(detail, phase);

  return (
    <Section title="Fechas" footer={trip.createdBy ? `Creado por ${trip.createdBy.name}` : undefined}>
      <Row label="Empieza" value={d.start} note={d.startNote} />
      <Row label="Termina" value={d.end} note={d.endNote} />
      <Row label="Se revela" value={d.reveal} note={d.revealNote} />
    </Section>
  );
}

/** Just the reveal date, for the board (the rest of the dates are in "Ajustes del rollo"). */
export function RevealRow({ detail, phase }: { detail: TripDetail; phase: RollPhase | null }) {
  const d = dateParts(detail, phase);
  return (
    <Section>
      <Row label="Se revela" value={d.reveal} note={d.revealNote} />
    </Section>
  );
}

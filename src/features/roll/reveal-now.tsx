import { isEvent } from "@/features/events/event";
import type { TripDetail } from "@/features/trips/actions";
import type { RollPhase } from "@/features/trips/phase";
import { ErrorText, Row, Section } from "@/ui/components";
import { useRevealTrip } from "./use-reveal-trip";

/** "Revelar ahora": only for events, only the creator, once the roll ended and before it is revealed. */
export function RevealNowSection({ detail, phase }: { detail: TripDetail; phase: RollPhase | null }) {
  const reveal = useRevealTrip(detail.trip.id, detail.trip.name, !!detail.trip.contest?.enabled);
  if (!isEvent(detail.trip) || !detail.me.isCreator || phase !== "ended") return null;
  return (
    <>
      <Section>
        <Row label="Revelar ahora" tone="tint" chevron={false} loading={reveal.revealing} onPress={reveal.revealing ? undefined : reveal.confirm} />
      </Section>
      {!!reveal.error && <ErrorText>{reveal.error}</ErrorText>}
    </>
  );
}

import { useRouter } from "expo-router";
import type { TripDetail } from "@/features/trips/actions";
import { isOrganizer } from "@/features/events/event";
import type { RollPhase } from "@/features/trips/phase";
import { Row, Section } from "@/ui/components";
import { pickCountLabel, picksRowVisible } from "./contest-state";
import { useContest } from "./use-contest";

/** The board's "Elegí las finalistas · N de 10": for an organizer of an event with a contest, once it ended and until the reveal. */
export function PicksRow({ detail, phase }: { detail: TripDetail; phase: RollPhase | null }) {
  const router = useRouter();
  const visible = picksRowVisible({ organizer: isOrganizer(detail), contestEnabled: !!detail.trip.contest?.enabled, phase });
  const { contest } = useContest(detail.trip.id, visible);
  if (!visible) return null;
  return (
    <Section>
      <Row
        label="Elegí las finalistas"
        value={pickCountLabel(contest?.finalists.length ?? 0)}
        onPress={() => router.push({ pathname: "/contest-picks", params: { trip: detail.trip.id } })}
      />
    </Section>
  );
}

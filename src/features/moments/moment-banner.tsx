import { router } from "expo-router";
import { Row, Section } from "@/ui/components";
import { formatLeft } from "./moment-time";
import { useCurrentMoment } from "./use-current-moment";

/** "Tu momento · quedan 3:00" at the top of Rollo while a fired moment of this roll is open; nothing otherwise. */
export function MomentBanner({ tripId }: { tripId: string }) {
  const moment = useCurrentMoment();
  if (!moment || moment.tripId !== tripId) return null;
  return (
    <Section>
      <Row
        tone="tint"
        label={`Tu momento · quedan ${formatLeft(moment.leftMs)}`}
        onPress={() => router.push(`/moment?trip=${moment.tripId}&day=${moment.day}&at=${moment.at}` as never)}
      />
    </Section>
  );
}

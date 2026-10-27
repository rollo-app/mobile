import { StyleSheet, Text } from "react-native";
import { BelowUploads, UploadStatusSection } from "@/features/capture/upload-status-section";
import { useRevealedPhotos } from "@/features/media/revealed";
import { useRollPhase } from "@/features/trips/use-roll-phase";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Loading, Screen } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { RollDates } from "./roll-dates";
import { RollPeople } from "./roll-people";
import { rollSummary } from "./summary";

/** The "Rollo" segment of a revealed roll: what the board showed, without today's quota or the contact sheet. */
export function RollOverview({ tripId }: { tripId: string }) {
  const { detail, error, refetch, isRefetching } = useTripDetail(tripId);
  const { photos } = useRevealedPhotos(tripId);
  const phase = useRollPhase(detail);

  return (
    <Screen grouped testID="roll-overview">
      {error && (
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      )}
      {!error && !detail && <Loading />}
      {detail && (
        <>
          <Text style={[type.subhead, styles.summary]}>
            {rollSummary({
              media: photos,
              people: detail.members.length,
              startsAt: detail.trip.startsAt,
              endsAt: detail.trip.endsAt,
              timeZone: detail.trip.timezone,
            })}
          </Text>
          <RollDates detail={detail} phase={phase} />
          <UploadStatusSection tripId={tripId} timeZone={detail.trip.timezone} />
          <BelowUploads>
            <RollPeople detail={detail} />
          </BelowUploads>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { color: colors.secondaryLabel, paddingHorizontal: spacing.xs, fontVariant: ["tabular-nums"] },
});

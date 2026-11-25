import { router } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { ContestCard } from "@/features/contest/contest-card";
import { EventBoardHero } from "@/features/events/event-board-hero";
import { BelowUploads, UploadStatusSection } from "@/features/capture/upload-status-section";
import { useRevealedPhotos } from "@/features/media/revealed";
import { collageCandidates } from "@/features/share/collage";
import { OriginalsNotice } from "@/features/trips/originals-notice-text";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Loading, Row, Screen, Section } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { RollEssentials } from "./roll-essentials";
import { rollSummary } from "./summary";
import { memberTotal } from "@/features/trips/member-total";

/** The "Rollo" segment of a revealed roll: what the board showed, without today's quota or the contact sheet. */
export function RollOverview({ tripId, focused }: { tripId: string; /** The screen is in view (see `ContestCard`). */ focused: boolean }) {
  const { detail, error, refetch, isRefetching } = useTripDetail(tripId);
  const { photos } = useRevealedPhotos(tripId);

  return (
    <Screen grouped testID="roll-overview">
      {!!error && (
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      )}
      {!error && !detail && <Loading />}
      {detail && (
        <>
          <ContestCard tripId={tripId} enabled={!!detail.trip.contest?.enabled} focused={focused} />
          <EventBoardHero detail={detail} />
          <Text style={[type.subhead, styles.summary]}>
            {rollSummary({
              media: photos,
              people: memberTotal(detail),
              startsAt: detail.trip.startsAt,
              endsAt: detail.trip.endsAt,
              timeZone: detail.trip.timezone,
            })}
          </Text>
          {!detail.trip.featuringDisabled && collageCandidates(photos).length > 0 && (
            <Section>
              <Row label="Compartir en Stories" onPress={() => router.push({ pathname: "/share-story", params: { tripId, kind: "collage" } })} />
            </Section>
          )}
          <OriginalsNotice originals={detail.trip.originals} timeZone={detail.trip.timezone} style={styles.notice} />
          <UploadStatusSection tripId={tripId} timeZone={detail.trip.timezone} />
          <BelowUploads>
            <RollEssentials detail={detail} />
          </BelowUploads>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { paddingHorizontal: spacing.xs },
  summary: { color: colors.secondaryLabel, paddingHorizontal: spacing.xs, fontVariant: ["tabular-nums"] },
});

import { StyleSheet, Text, View } from "react-native";
import { UploadStatusSection } from "@/features/capture/upload-status-section";
import { usePendingCount } from "@/features/capture/use-pending-count";
import { usePendingItems } from "@/features/capture/use-pending-items";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useFeed } from "@/features/trips/use-feed";
import { useRollPhase } from "@/features/trips/use-roll-phase";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Footnote, Loading, Row, Screen, Section } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { ContactSheet } from "./contact-sheet-view";
import { RollDates } from "./roll-dates";
import { RollPeople } from "./roll-people";

/** The Rollo tab before the reveal: contact sheet, today's quota, dates, uploads and people. */
export function RollBoard() {
  const { trip } = useActiveTrip();
  const { detail, error, refetch, isRefetching } = useTripDetail(trip?.id);
  const pending = usePendingCount(trip?.id);
  const { feed } = useFeed(trip?.id);
  const pendingItems = usePendingItems(trip?.id);
  const phase = useRollPhase(detail);
  // Your queued photos are already in the roll, even if they haven't been uploaded yet.
  const total = (detail?.totalUploaded ?? 0) + pending;

  return (
    <Screen grouped>
      {error ? (
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      ) : !detail ? (
        <Loading />
      ) : (
        <>
          <View style={styles.block}>
            <View style={styles.header}>
              <Text style={[type.headline, { color: colors.label }]}>En el rollo</Text>
              <Text style={[type.body, styles.count]}>{total}</Text>
            </View>
            <ContactSheet total={total} feed={feed?.items ?? []} pending={pendingItems} />
            <Footnote>Nadie las ve hasta el revelado. Ni vos.</Footnote>
          </View>

          {phase === "active" && (
            detail.trip.photoLimitMode === "total" ? (
              <Section title="Tu cupo">
                <Row label="Te quedan" value={`${detail.today.photosLeft} de ${detail.trip.totalPhotoLimit ?? 0}`} />
              </Section>
            ) : (
              <Section title="Hoy">
                <Row label="Fotos" value={`${detail.today.photosLeft} de ${detail.trip.dailyPhotoLimit}`} />
              </Section>
            )
          )}

          <RollDates detail={detail} phase={phase} />

          <UploadStatusSection tripId={detail.trip.id} timeZone={detail.trip.timezone} />
          <RollPeople detail={detail} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: spacing.xs },
  count: { color: colors.secondaryLabel, fontVariant: ["tabular-nums"] },
});

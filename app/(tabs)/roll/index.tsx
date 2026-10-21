import { Image } from "expo-image";
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { GalleryScreen } from "@/features/gallery/gallery-screen";
import { UploadStatusSection } from "@/features/capture/upload-status-section";
import { OfflineMapRow } from "@/features/map/offline-map-row";
import { TabSwipe } from "@/features/navigation/tab-swipe";
import { RollPeople } from "@/features/roll/roll-people";
import { usePendingItems } from "@/features/capture/use-pending-items";
import { usePendingCount } from "@/features/capture/use-pending-count";
import { buildContactSheet } from "@/features/roll/contact-sheet";
import { Welcome } from "@/features/roll/welcome";
import { hasNoTrips } from "@/features/trips/active";
import { daysUntil, formatDateTime, startsIn } from "@/features/trips/phase";
import { TripSwitcher } from "@/features/trips/trip-switcher";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useRollPhase } from "@/features/trips/use-roll-phase";
import { useFeed } from "@/features/trips/use-feed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Footnote, Loading, Row, Screen, Section } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";

const COLUMNS = 6;

/** After the reveal the Rollo tab is the gallery; before, the board. */
export default function RollScreen() {
  const { trip, loaded } = useActiveTrip();
  const { detail } = useTripDetail(trip?.id);
  const phase = useRollPhase(detail);
  return (
    <TabSwipe current="roll">
      {hasNoTrips(loaded, trip) ? <Welcome /> : trip && phase === "revealed" ? <GalleryScreen tripId={trip.id} /> : <RollBoard />}
    </TabSwipe>
  );
}

function RollBoard() {
  const { trip } = useActiveTrip();
  const { detail, error, refetch, isRefetching } = useTripDetail(trip?.id);
  const pending = usePendingCount(trip?.id);
  const { feed } = useFeed(trip?.id);
  const pendingItems = usePendingItems(trip?.id);
  const phase = useRollPhase(detail);
  // Your queued photos are already in the roll, even if they haven't been uploaded yet.
  const total = (detail?.totalUploaded ?? 0) + pending;

  const tz = detail?.trip.timezone ?? "";
  const at = (ms: number) => formatDateTime(ms, Date.now(), tz);
  const startNote = phase === "upcoming" ? startsIn(detail!.trip.startsAt, Date.now(), tz) : "Empezó";
  const endNote = phase === "ended" || phase === "revealed" ? "Terminó" : undefined;
  const revealNote =
    phase === "revealed" ? "Se reveló" : detail ? daysUntil(detail.trip.revealAt, Date.now(), tz) : undefined;

  return (
    <Screen grouped>
      {trip && <Stack.Screen options={{ headerTitle: () => <TripSwitcher name={trip.name} /> }} />}
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
            <Section title="Hoy">
              <Row label="Fotos" value={`${detail.today.photosLeft} de ${detail.trip.dailyPhotoLimit}`} />
              <Row label="Videos" value={`${detail.today.videosLeft} de ${detail.trip.dailyVideoLimit}`} />
            </Section>
          )}

          <Section title="Fechas">
            <Row label="Empieza" value={at(detail.trip.startsAt)} note={startNote} />
            <Row label="Termina" value={at(detail.trip.endsAt)} note={endNote} />
            <Row label="Se revela" value={at(detail.trip.revealAt)} note={revealNote} />
          </Section>

          <UploadStatusSection tripId={detail.trip.id} timeZone={detail.trip.timezone} />
          <RollPeople detail={detail} />

          <Section>
            <OfflineMapRow />
          </Section>
        </>
      )}
    </Screen>
  );
}

/**
 * The contact sheet: one frame per photo in the roll, not yet developed. Each shows
 * the blurry colors (ThumbHash) of its photo, newest to oldest; without a thumbhash
 * it's gray, and the filler frames in the last row are dimmer.
 */
function ContactSheet({
  total,
  feed,
  pending,
}: {
  total: number;
  feed: { takenAt: number; thumbhash: string | null }[];
  pending: { takenAt: number; thumbhash: string | null }[];
}) {
  const { frames, rest } = buildContactSheet({ feed, pending, total });
  const shown = frames.length;
  const cells = Math.max(Math.ceil(shown / COLUMNS), 1) * COLUMNS;
  const rows = Array.from({ length: cells / COLUMNS }, (_, r) =>
    Array.from({ length: COLUMNS }, (_, c) => r * COLUMNS + c),
  );
  return (
    <View accessible accessibilityLabel={`${total} en el rollo`} style={styles.sheet}>
      {rows.map((row, r) => (
        <View key={r} style={styles.sheetRow}>
          {row.map((i) => {
            const thumbhash = frames[i];
            return (
              <View key={i} style={[styles.frame, { backgroundColor: i < shown ? colors.latent : colors.fill }]}>
                {thumbhash && <Image testID={`thumbhash-${thumbhash}`} placeholder={{ thumbhash }} style={StyleSheet.absoluteFill} />}
                {rest > 0 && i === shown - 1 && (
                  <>
                    {thumbhash && <View style={styles.dim} />}
                    <Text style={[type.footnote, styles.more, thumbhash ? styles.moreOnPhoto : null]}>+{rest + 1}</Text>
                  </>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: spacing.xs },
  count: { color: colors.secondaryLabel, fontVariant: ["tabular-nums"] },
  sheet: {
    gap: 3,
    borderRadius: radius.md,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  sheetRow: { flexDirection: "row", gap: 3 },
  frame: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  more: { color: colors.secondaryLabel, fontWeight: "600" },
  moreOnPhoto: { color: "#FFFFFF" },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.35)" },
});

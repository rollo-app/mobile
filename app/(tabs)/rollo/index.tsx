import { Image } from "expo-image";
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { usePendingItems } from "@/features/capture/use-pending-items";
import { usePendingCount } from "@/features/capture/use-pending-count";
import { buildContactSheet } from "@/features/rollo/contact-sheet";
import { TripSwitcher } from "@/features/trips/trip-switcher";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useFeed } from "@/features/trips/use-feed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Footnote, Loading, Row, Screen, Section } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";

const DAY = 24 * 60 * 60 * 1000;
const COLUMNS = 6;

export default function RolloScreen() {
  const { trip } = useActiveTrip();
  const { detail, error, refetch, isRefetching } = useTripDetail(trip?.tripId);
  const pending = usePendingCount(trip?.tripId);
  const { feed } = useFeed(trip?.tripId);
  const pendingItems = usePendingItems(trip?.tripId);
  // Tus fotos en cola ya están en el rollo, aunque todavía no se hayan subido.
  const total = (detail?.totalUploaded ?? 0) + pending;

  return (
    <Screen grouped>
      {trip && <Stack.Screen options={{ headerTitle: () => <TripSwitcher name={trip.tripName} /> }} />}
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

          <Section title="Hoy">
            <Row label="Fotos" value={`${detail.today.photosLeft} de ${detail.trip.dailyPhotoLimit}`} />
            <Row label="Videos" value={`${detail.today.videosLeft} de ${detail.trip.dailyVideoLimit}`} />
          </Section>

          <Section title="Revelado">
            <Row label={formatDay(detail.trip.revealAt, detail.trip.timezone)} value={untilReveal(detail.trip)} />
          </Section>
        </>
      )}
    </Screen>
  );
}

/**
 * La hoja de contacto: un cuadro por cada foto del rollo, todavía sin revelar. Cada uno muestra
 * los colores difusos (ThumbHash) de su foto, de la más nueva a la más vieja; sin thumbhash
 * queda gris, y los cuadros de relleno de la última fila, más apagados.
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

function formatDay(ms: number, timeZone: string) {
  return new Date(ms).toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone });
}

function untilReveal(trip: { revealed: boolean; revealAt: number }) {
  if (trip.revealed) return "revelado";
  const days = Math.ceil((trip.revealAt - Date.now()) / DAY);
  if (days <= 0) return "hoy";
  return days === 1 ? "mañana" : `en ${days} días`;
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

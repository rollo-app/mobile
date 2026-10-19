import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { TripSwitcher } from "@/features/trips/trip-switcher";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { ErrorText, Footnote, Loading, Row, Screen, Section } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";

const DAY = 24 * 60 * 60 * 1000;
const SHEET_FRAMES = 18;
const COLUMNS = 6;

export default function RolloScreen() {
  const { trip } = useActiveTrip();
  const { detail, error } = useTripDetail(trip?.tripId);

  return (
    <Screen grouped>
      {trip && <Stack.Screen options={{ headerTitle: () => <TripSwitcher name={trip.tripName} /> }} />}
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : !detail ? (
        <Loading />
      ) : (
        <>
          <View style={styles.block}>
            <View style={styles.header}>
              <Text style={[type.headline, { color: colors.label }]}>En el rollo</Text>
              <Text style={[type.body, styles.count]}>{detail.totalUploaded}</Text>
            </View>
            <ContactSheet total={detail.totalUploaded} />
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
 * La hoja de contacto: un cuadro por cada foto del rollo, todavía sin revelar.
 * Cuando el server mande el ThumbHash, cada cuadro va a mostrar sus colores difusos.
 */
function ContactSheet({ total }: { total: number }) {
  const shown = Math.min(total, SHEET_FRAMES);
  const rest = total - shown;
  const cells = Math.max(Math.ceil(shown / COLUMNS), 1) * COLUMNS;
  const rows = Array.from({ length: cells / COLUMNS }, (_, r) =>
    Array.from({ length: COLUMNS }, (_, c) => r * COLUMNS + c),
  );
  return (
    <View accessible accessibilityLabel={`${total} en el rollo`} style={styles.sheet}>
      {rows.map((row, r) => (
        <View key={r} style={styles.sheetRow}>
          {row.map((i) => (
            <View key={i} style={[styles.frame, { backgroundColor: i < shown ? colors.latent : colors.fill }]}>
              {rest > 0 && i === shown - 1 && <Text style={[type.footnote, styles.more]}>+{rest + 1}</Text>}
            </View>
          ))}
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
});

import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTodayLeft } from "@/features/capture/use-today-left";
import { canShareInvite } from "@/features/share/invite";
import { Badge } from "@/ui/badge";
import { colors, radius, spacing, type } from "@/ui/theme";
import type { TripSummary } from "./active";
import { coverContentPosition } from "./cover-focus";
import { coverUri } from "./cover-uri";
import { liveDayLabel } from "./row-state";
import { useTripDetail } from "./use-trip-detail";

const STRIPS = 16;
const DEVICE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
/** Behind the white text while there is no cover image (a new roll): colors.fill is near-white in light mode. */
const FALLBACK_BG = "#2C2C2E";

/** "Te quedan 6 fotos hoy" (daily limit) / "Te quedan 6 fotos en el rollo" (total limit). */
export function leftLabel(photos: number, mode: "daily" | "total") {
  const where = mode === "total" ? "en el rollo" : "hoy";
  return photos === 1 ? `Te queda 1 foto ${where}` : `Te quedan ${photos} fotos ${where}`;
}

/**
 * Big card of a roll in progress: blurred cover, day, name, photos left, a camera button for that roll and, while it has room,
 * a share button that invites to it.
 */
export function LiveRollCard({ trip, onOpen, onCamera, onShare }: { trip: TripSummary; onOpen: () => void; onCamera: () => void; onShare?: () => void }) {
  const { detail } = useTripDetail(trip.id);
  const share = onShare && detail && canShareInvite(detail) ? onShare : null;
  const left = useTodayLeft(trip.id, detail);
  const timeZone = detail?.trip.timezone ?? DEVICE_ZONE;
  const uri = coverUri(trip.coverUrl);
  const isEvent = trip.type === "event";

  return (
    <Pressable
      testID="live-roll-card"
      accessibilityRole="button"
      accessibilityLabel={isEvent ? `${trip.name}, evento, en vivo` : `${trip.name}, en vivo`}
      // The camera button below is its own Pressable, which VoiceOver can't reach inside the grouped card: expose it as an action.
      accessibilityActions={[{ name: "camera", label: "Sacar una foto" }, ...(share ? [{ name: "share", label: "Invitar" }] : [])]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === "camera") onCamera();
        if (nativeEvent.actionName === "share") share?.();
      }}
      onPress={onOpen}
      style={styles.card}
    >
      <Image
        source={uri ? { uri } : undefined}
        placeholder={trip.coverThumbhash ? { thumbhash: trip.coverThumbhash } : undefined}
        contentFit="cover"
        contentPosition={coverContentPosition(trip.coverFocusY)}
        testID="live-roll-cover"
        style={StyleSheet.absoluteFill}
        accessibilityIgnoresInvertColors
      />
      <View pointerEvents="none" style={styles.shade}>
        {Array.from({ length: STRIPS }, (_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: `rgba(0,0,0,${(0.2 + 0.42 * ((i + 0.5) / STRIPS) ** 1.2).toFixed(3)})` }} />
        ))}
      </View>
      <View style={styles.top}>
        <Badge variant="live" label="LIVE" />
        {isEvent && <Badge variant="overlay" label="Evento" />}
        <Text style={[type.footnote, styles.day]}>{liveDayLabel(trip, Date.now(), timeZone)}</Text>
      </View>
      <View style={styles.bottom}>
        <View style={styles.text}>
          <Text style={[type.title, styles.name]} numberOfLines={2}>
            {trip.name}
          </Text>
          {left && (
            <Text style={[type.subhead, styles.left]} numberOfLines={1}>
              {leftLabel(left.photos, detail?.trip.photoLimitMode ?? "daily")}
            </Text>
          )}
        </View>
        {share && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Invitar a ${trip.name}`}
            onPress={share}
            hitSlop={6}
            style={({ pressed }) => [styles.share, pressed && { opacity: 0.8 }]}
          >
            <SymbolView name="square.and.arrow.up" size={20} tintColor="#FFFFFF" />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sacar una foto en ${trip.name}`}
          onPress={onCamera}
          hitSlop={6}
          style={({ pressed }) => [styles.camera, pressed && { opacity: 0.8 }]}
        >
          <SymbolView name="camera.fill" size={22} tintColor="#FFFFFF" />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { height: 180, borderRadius: radius.lg, borderCurve: "continuous", overflow: "hidden", justifyContent: "space-between", padding: spacing.md, backgroundColor: FALLBACK_BG },
  shade: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, flexDirection: "column" },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  day: { color: "#FFFFFF", fontWeight: "600" },
  bottom: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  text: { flex: 1, gap: 2 },
  name: { color: "#FFFFFF" },
  left: { color: "rgba(255,255,255,0.85)" },
  // Secondary to the camera: a translucent white circle over the dark cover, not the brand color.
  share: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  camera: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" },
});

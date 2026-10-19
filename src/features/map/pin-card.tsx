import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "@/ui/theme";
import type { MapItem } from "./features";
import { formatPinTime } from "./pin-time";

/** Tarjeta flotante de una foto del mapa: ni la foto se ve, solo su thumbhash borroso. */
export function PinCard({ item, timeZone, now }: { item: MapItem; timeZone: string; now?: number }) {
  const when = formatPinTime(item.takenAt, timeZone, now);
  const meta = item.type === "video" ? `Video · ${Math.round(item.durationS ?? 0)} s` : null;

  return (
    <View accessibilityLabel={`${item.authorName}, ${when}`} style={styles.card}>
      {item.thumbhash ? (
        <Image
          testID="pin-thumb"
          placeholder={{ thumbhash: item.thumbhash }}
          style={styles.thumb}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View testID="pin-thumb-empty" style={[styles.thumb, { backgroundColor: colors.latent }]} />
      )}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[type.headline, { color: colors.label }]}>
          {item.authorName}
        </Text>
        <Text style={[type.subhead, { color: colors.secondaryLabel }]}>{meta ? `${when} · ${meta}` : when}</Text>
        {item.caption ? (
          <Text numberOfLines={2} style={[type.quote, { color: colors.label }]}>
            {item.caption}
          </Text>
        ) : null}
        {item.pending ? <Text style={[type.footnote, { color: colors.secondaryLabel }]}>Esperando señal</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    backgroundColor: colors.background,
    boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
  },
  thumb: { width: 88, height: 88, borderRadius: radius.md, borderCurve: "continuous" },
  text: { flex: 1, gap: 2, justifyContent: "center" },
});

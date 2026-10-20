import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mediaSource } from "@/features/media/revealed";
import { colors, radius, spacing, type } from "@/ui/theme";
import type { MapItem } from "./features";
import { formatPinTime } from "./pin-time";

/**
 * Floating card for a map photo. Before the reveal only its blurry thumbhash shows; after it, the real
 * thumbnail (loaded with the roll's token) fades in over the thumbhash and tapping the card calls `onOpen`.
 */
export function PinCard({
  item,
  timeZone,
  now,
  token,
  onOpen,
}: {
  item: MapItem;
  timeZone: string;
  now?: number;
  token?: string | null;
  onOpen?: () => void;
}) {
  const when = formatPinTime(item.takenAt, timeZone, now);
  const meta = item.type === "video" ? `Video · ${Math.round(item.durationS ?? 0)} s` : null;

  const source = item.thumbPath && token ? mediaSource(item.thumbPath, token) : undefined;
  const Card = onOpen ? Pressable : View;

  return (
    <Card
      accessibilityLabel={`${item.authorName}, ${when}`}
      {...(onOpen ? { accessibilityRole: "button" as const, onPress: onOpen } : {})}
      style={styles.card}
    >
      {item.thumbhash || source ? (
        <Image
          testID="pin-thumb"
          source={source}
          placeholder={item.thumbhash ? { thumbhash: item.thumbhash } : undefined}
          transition={source ? 200 : 0}
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
    </Card>
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

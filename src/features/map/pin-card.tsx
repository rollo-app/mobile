import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MomentBadge, momentBadgeCorner } from "@/features/media/moment-badge";
import { mediaSource } from "@/features/media/revealed";
import { Avatar } from "@/features/profile/avatar";
import { colors, radius, spacing, type } from "@/ui/theme";
import type { MapItem } from "./features";
import { formatPinTime } from "./pin-time";

/**
 * Floating card for a map photo. Before the reveal only its blurry thumbhash shows; after it, the real
 * thumbnail (loaded with the roll's token) fades in over the thumbhash and tapping it (or the text)
 * calls `onOpen`. The author's photo and name are their own button (`onAuthorPress`: their profile).
 */
export function PinCard({
  item,
  timeZone,
  now,
  token,
  onOpen,
  onAuthorPress,
}: {
  item: MapItem;
  timeZone: string;
  now?: number;
  token?: string | null;
  onOpen?: () => void;
  onAuthorPress?: () => void;
}) {
  const when = formatPinTime(item.takenAt, timeZone, now);
  const meta = item.type === "video" ? `Video · ${Math.round(item.durationS ?? 0)} s` : null;

  const source = item.thumbPath && token ? mediaSource(item.thumbPath, token) : undefined;

  const image =
    item.thumbhash || source ? (
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
    );
  const thumb = item.momentDay ? (
    <View>
      {image}
      <MomentBadge style={momentBadgeCorner} />
    </View>
  ) : (
    image
  );

  const author = (
    <>
      <Avatar id={item.authorId} name={item.authorName} avatarUrl={item.authorAvatarUrl} size={40} />
      <Text numberOfLines={1} style={[type.headline, styles.authorName, { color: colors.label }]}>
        {item.authorName}
      </Text>
    </>
  );

  const details = (
    <>
      <Text style={[type.subhead, { color: colors.secondaryLabel }]}>{meta ? `${when} · ${meta}` : when}</Text>
      {item.caption ? (
        <Text numberOfLines={2} style={[type.quote, { color: colors.label }]}>
          {item.caption}
        </Text>
      ) : null}
      {item.pending ? <Text style={[type.footnote, { color: colors.secondaryLabel }]}>Esperando señal</Text> : null}
    </>
  );

  return (
    <View style={styles.card}>
      {onOpen ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.authorName}, ${when}`} onPress={onOpen}>
          {thumb}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={`${item.authorName}, ${when}`}>
          {thumb}
        </View>
      )}
      <View style={styles.text}>
        {onAuthorPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Perfil de ${item.authorName}`}
            onPress={onAuthorPress}
            style={({ pressed }) => [styles.author, pressed && styles.pressed]}
          >
            {author}
          </Pressable>
        ) : (
          <View style={styles.author}>{author}</View>
        )}
        {/* The rest of the text also opens the photo; VoiceOver reaches it through the thumbnail. */}
        {onOpen ? (
          <Pressable accessible={false} onPress={onOpen} style={styles.details}>
            {details}
          </Pressable>
        ) : (
          <View style={styles.details}>{details}</View>
        )}
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
  author: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", maxWidth: "100%" },
  pressed: { opacity: 0.5 },
  details: { gap: 2 },
  authorName: { flexShrink: 1 },
  thumb: { width: 88, height: 88, borderRadius: radius.md, borderCurve: "continuous" },
  text: { flex: 1, gap: 2, justifyContent: "center" },
});

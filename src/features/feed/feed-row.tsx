import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { memo } from "react";
import { ActionSheetIOS, Pressable, StyleSheet, Text, View } from "react-native";
import type { MapItem } from "@/features/map/features";
import { Avatar } from "@/features/profile/avatar";
import { formatHandle } from "@/features/profile/username";
import { colors, radius, spacing, type } from "@/ui/theme";

const THUMB = 56;

/** Capture time "14:32" in the trip's time zone. */
export function clockTime(takenAt: number, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(takenAt);
}

type Props = {
  item: MapItem;
  timeZone: string;
  /** Tap on a row with a location (goes to the map). Without a location the row is not tappable. */
  onPress?: (item: MapItem) => void;
  /** Admin only: enables "Borrar foto" (action sheet) on long-press of the row. */
  onDelete?: (item: MapItem) => void;
};

/** A native Feed row: who, when, the caption (or what they took) and the blurred photo. */
export const FeedRow = memo(function FeedRow({ item, timeZone, onPress, onDelete }: Props) {
  const who = item.authorUsername ? formatHandle(item.authorUsername) : item.authorName;
  const when = clockTime(item.takenAt, timeZone);
  const generic = item.type === "video" ? `sacó un video · ${Math.round(item.durationS ?? 0)} s` : "sacó una foto";
  const located = item.lat !== null && item.lng !== null;

  const content = (
    <View testID="feed-row" style={styles.row}>
      <Avatar id={item.authorId} name={item.authorName} avatarUrl={item.authorAvatarUrl} size={40} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[type.footnote, { color: colors.secondaryLabel }]}>
          <Text style={{ fontWeight: "600", color: colors.label }}>{who}</Text>
          {" · "}
          <Text>{when}</Text>
        </Text>
        {item.caption ? (
          <Text numberOfLines={3} style={[type.quote, { color: colors.label }]}>
            {item.caption}
          </Text>
        ) : (
          <Text style={[type.body, { color: colors.label }]}>{generic}</Text>
        )}
        {item.pending ? <Text style={[type.footnote, { color: colors.secondaryLabel }]}>Esperando señal</Text> : null}
      </View>
      {item.thumbhash ? (
        <Image testID="feed-thumb" placeholder={{ thumbhash: item.thumbhash }} style={styles.thumb} accessibilityIgnoresInvertColors />
      ) : (
        <View testID="feed-thumb-empty" style={[styles.thumb, { backgroundColor: colors.latent }]} />
      )}
    </View>
  );

  const canDelete = !!onDelete && !item.pending;
  if (!(located && onPress) && !canDelete) return content;

  // Long-press opens the native action sheet (admin only). We don't use MenuView: it is a native host
  // that takes its content's size and the row stopped filling the width.
  function openSheet() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ["Borrar foto", "Cancelar"], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
      (index) => {
        if (index === 0) onDelete?.(item);
      },
    );
  }

  return (
    <Pressable
      accessibilityRole={located && onPress ? "button" : undefined}
      accessibilityLabel={`${who}, ${when}`}
      accessibilityHint={located && onPress ? "Abre la foto en el mapa" : undefined}
      onPress={located && onPress ? () => onPress(item) : undefined}
      onLongPress={canDelete ? openSheet : undefined}
      style={({ pressed }) => [styles.fill, pressed && { backgroundColor: colors.fill }]}
    >
      {content}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // All wrappers (Pressable, MenuView) fill the width: so the thumbnail always stays on the right.
  fill: { alignSelf: "stretch" },
  row: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  text: { flex: 1, gap: 2 },
  thumb: { flexShrink: 0, width: THUMB, height: THUMB, borderRadius: radius.sm, borderCurve: "continuous" },
});

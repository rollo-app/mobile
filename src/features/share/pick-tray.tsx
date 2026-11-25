import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";
import { colors, spacing, type } from "@/ui/theme";
import { COLLAGE_MAX } from "./collage";

const THUMB = 36;
/** Height of the tray without the bottom safe area: padding, label, gap and the row of thumbnails. */
export const TRAY_HEIGHT = StyleSheet.hairlineWidth + spacing.sm + 16 + spacing.sm + THUMB + spacing.sm;

export type PickTrayProps = {
  /** Selected photo ids, in collage order (the first is the big photo). */
  selection: string[];
  /** Candidates by id; a selected id missing here (its page isn't loaded yet) shows as a blank thumbnail. */
  photos: ReadonlyMap<string, RevealedPhoto>;
  token: string | null;
  /** Bottom safe area, added below the row. */
  bottomInset: number;
  onRemove: (id: string) => void;
};

/** Bottom tray of the picker: the chosen photos in order, then dashed slots showing how many are left. */
export function PickTray({ selection, photos, token, bottomInset, onRemove }: PickTrayProps) {
  const empty = Array.from({ length: Math.max(0, COLLAGE_MAX - selection.length) }, (_, i) => i);
  return (
    <View style={[styles.tray, { height: TRAY_HEIGHT + bottomInset, paddingBottom: bottomInset + spacing.sm }]}>
      <Text style={[type.caption, styles.label]}>{`En el collage · ${selection.length} de ${COLLAGE_MAX}`}</Text>
      <View style={styles.row}>
        {selection.map((id, i) => {
          const photo = photos.get(id);
          return (
            <Pressable
              key={id}
              testID={`pick-tray-${id}`}
              accessibilityRole="button"
              accessibilityLabel={`Quitar foto ${i + 1} del collage`}
              onPress={() => onRemove(id)}
              style={styles.thumb}
            >
              {!!token && !!photo && (
                <Image
                  source={mediaSource(photo.thumbPath, token)}
                  placeholder={photo.thumbhash ? { thumbhash: photo.thumbhash } : undefined}
                  contentFit="cover"
                  recyclingKey={photo.id}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <View style={styles.badge}>
                <Text testID={`pick-tray-badge-${id}`} style={styles.badgeText}>
                  {i + 1}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {empty.map((i) => (
          <View key={`empty-${i}`} testID="pick-tray-empty" style={styles.empty} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.sm,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  label: { color: colors.secondaryLabel, height: 16, marginBottom: spacing.sm, fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", gap: 6 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 5, overflow: "hidden", backgroundColor: colors.latent },
  empty: {
    width: THUMB,
    height: THUMB,
    borderRadius: 5,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.separator,
  },
  badge: {
    position: "absolute",
    top: 2,
    left: 2,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    paddingHorizontal: 2,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.onTint, fontSize: 9, fontWeight: "700", fontVariant: ["tabular-nums"] },
});

import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";
import { colors, type } from "@/ui/theme";

export type PickCellProps = {
  photo: RevealedPhoto;
  token: string | null;
  size: number;
  /** 1-based position in the selection (1 is the big photo), null when not selected. */
  order: number | null;
  /** The selection is full and this photo isn't in it. */
  dimmed: boolean;
  onPress: (id: string) => void;
};

/** One candidate in the picker grid: memoized, it re-renders only when its own number or dimming changes. */
export const PickCell = memo(function PickCell({ photo, token, size, order, dimmed, onPress }: PickCellProps) {
  return (
    <Pressable
      testID={`pick-cell-${photo.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Foto de ${photo.author.name}`}
      accessibilityState={{ selected: order !== null }}
      onPress={() => onPress(photo.id)}
      style={{ width: size, height: size, backgroundColor: colors.latent }}
    >
      {!!token && (
        <Image
          source={mediaSource(photo.thumbPath, token)}
          placeholder={photo.thumbhash ? { thumbhash: photo.thumbhash } : undefined}
          transition={120}
          contentFit="cover"
          recyclingKey={photo.id}
          style={StyleSheet.absoluteFill}
        />
      )}
      {dimmed && <View pointerEvents="none" style={styles.dim} />}
      {order !== null && (
        <View style={styles.badge}>
          <Text testID={`pick-badge-${photo.id}`} style={[type.caption, styles.badgeText]}>
            {order}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(255,255,255,0.55)" },
  badge: {
    position: "absolute",
    top: 5,
    right: 5,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 4,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.onTint, fontWeight: "700", fontVariant: ["tabular-nums"] },
});

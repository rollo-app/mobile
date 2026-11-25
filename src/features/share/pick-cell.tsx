import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";
import { colors, type } from "@/ui/theme";

export type PickCellProps = {
  photo: RevealedPhoto;
  /** 0-based position in the grid and the grid's size, for the accessibility label. */
  index: number;
  total: number;
  token: string | null;
  size: number;
  /** 1-based position in the selection (1 is the big photo), null when not selected. */
  order: number | null;
  /** The selection is full and this photo isn't in it. */
  dimmed: boolean;
  onPress: (id: string) => void;
};

/** One candidate in the picker grid: memoized, it re-renders only when its own number or dimming changes. */
export const PickCell = memo(function PickCell({ photo, index, total, token, size, order, dimmed, onPress }: PickCellProps) {
  return (
    <Pressable
      testID={`pick-cell-${photo.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Foto ${index + 1} de ${total}${order !== null ? `, elegida ${order}` : ""}`}
      accessibilityState={{ selected: order !== null }}
      onPress={() => onPress(photo.id)}
      style={[styles.cell, { width: size, height: size }]}
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
      {order !== null && <View pointerEvents="none" style={styles.selectedBorder} />}
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
  cell: { borderRadius: 6, overflow: "hidden", backgroundColor: colors.latent },
  selectedBorder: { ...StyleSheet.absoluteFill, borderRadius: 6, borderWidth: 2, borderColor: colors.tint },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, opacity: 0.55 },
  badge: {
    position: "absolute",
    top: 5,
    right: 5,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.onTint,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.onTint, fontWeight: "700", fontVariant: ["tabular-nums"] },
});

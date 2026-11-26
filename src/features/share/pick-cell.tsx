import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SheetState } from "@/features/journey/sheet/sheet-photos";
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
  /** Show the position number; false shows a check instead (the order does not matter). */
  numbered?: boolean;
  onPress: (id: string) => void;
};

/** One candidate in the picker grid: memoized, it re-renders only when its own number or dimming changes. */
export const PickCell = memo(function PickCell({ photo, index, total, token, size, order, dimmed, numbered = true, onPress }: PickCellProps) {
  return (
    <Pressable
      testID={`pick-cell-${photo.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Foto ${index + 1} de ${total}${order !== null ? (numbered ? `, elegida ${order}` : ", elegida") : ""}`}
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
            {numbered ? order : "✓"}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

const SHEET_LABELS: Record<SheetState, string> = {
  highlight: "Foto destacada",
  sheet: "Foto en la hoja",
  out: "Foto fuera del video",
};

export type SheetPickCellProps = {
  photo: RevealedPhoto;
  token: string | null;
  size: number;
  /** highlight: cobalt ring and a star; sheet: plain; out: dimmed with a "no" mark. */
  state: SheetState;
  onPress: (id: string) => void;
};

/** One candidate in the summary picker: shows which of the three states it is in. */
export const SheetPickCell = memo(function SheetPickCell({ photo, token, size, state, onPress }: SheetPickCellProps) {
  return (
    <Pressable
      testID={`pick-cell-${photo.id}`}
      accessibilityRole="button"
      accessibilityLabel={SHEET_LABELS[state]}
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
          style={[StyleSheet.absoluteFill, state === "out" && styles.out]}
        />
      )}
      {state === "highlight" && <View pointerEvents="none" style={styles.selectedBorder} />}
      {state !== "sheet" && (
        <View testID={`pick-mark-${photo.id}`} style={[styles.badge, state === "out" && styles.outBadge]}>
          <SymbolView name={state === "highlight" ? "star.fill" : "eye.slash"} size={12} weight="bold" tintColor={colors.onTint} />
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  out: { opacity: 0.35 },
  outBadge: { backgroundColor: colors.secondaryLabel },
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

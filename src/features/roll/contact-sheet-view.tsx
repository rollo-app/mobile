import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, type } from "@/ui/theme";
import { buildContactSheet } from "./contact-sheet";

const COLUMNS = 6;

/**
 * The contact sheet: one frame per photo in the roll, not yet developed. Each shows
 * the blurry colors (ThumbHash) of its photo, newest to oldest; without a thumbhash
 * it's gray, and the filler frames in the last row are dimmer.
 */
export function ContactSheet({
  total,
  feed,
  pending,
}: {
  total: number;
  feed: { takenAt: number; thumbhash: string | null }[];
  pending: { takenAt: number; thumbhash: string | null }[];
}) {
  const { frames, rest } = buildContactSheet({ feed, pending, total });
  const shown = frames.length;
  const cells = Math.max(Math.ceil(shown / COLUMNS), 1) * COLUMNS;
  const rows = Array.from({ length: cells / COLUMNS }, (_, r) =>
    Array.from({ length: COLUMNS }, (_, c) => r * COLUMNS + c),
  );
  return (
    <View accessible accessibilityLabel={`${total} en el rollo`} style={styles.sheet}>
      {rows.map((row, r) => (
        <View key={r} style={styles.sheetRow}>
          {row.map((i) => {
            const thumbhash = frames[i];
            return (
              <View key={i} style={[styles.frame, { backgroundColor: i < shown ? colors.latent : colors.fill }]}>
                {thumbhash && <Image testID={`thumbhash-${thumbhash}`} placeholder={{ thumbhash }} style={StyleSheet.absoluteFill} />}
                {rest > 0 && i === shown - 1 && (
                  <>
                    {thumbhash && <View style={styles.dim} />}
                    <Text style={[type.footnote, styles.more, thumbhash ? styles.moreOnPhoto : null]}>+{rest + 1}</Text>
                  </>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: 3,
    borderRadius: radius.md,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  sheetRow: { flexDirection: "row", gap: 3 },
  frame: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  more: { color: colors.secondaryLabel, fontWeight: "600" },
  moreOnPhoto: { color: "#FFFFFF" },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.35)" },
});

import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/ui/theme";
import { progressStyle } from "./contest-state";

const TRACK = "rgba(255,255,255,0.35)";

/**
 * Where you are in the pager: one segment per finalist up to 20, a continuous bar past that, and "Finalista 3 de 12"
 * under it (`showTitle` false hides the title, e.g. in the results where each page has its own "2° puesto").
 * Sits over the photo, so it's always white.
 */
export function PagerProgress({ count, index, showTitle = true }: { count: number; index: number; showTitle?: boolean }) {
  if (count <= 0) return null;
  const current = Math.min(Math.max(index, 0), count - 1);
  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel={`Finalista ${current + 1} de ${count}`}>
      {progressStyle(count) === "segments" ? (
        <View style={styles.segments}>
          {Array.from({ length: count }, (_, i) => (
            <View key={i} testID="progress-segment" style={[styles.segment, { backgroundColor: i <= current ? colors.onTint : TRACK }]} />
          ))}
        </View>
      ) : (
        <View style={styles.bar}>
          <View testID="progress-bar-fill" style={[styles.barFill, { width: `${((current + 1) / count) * 100}%` }]} />
        </View>
      )}
      {showTitle && <Text style={[type.footnote, styles.title]}>{`Finalista ${current + 1} de ${count}`}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  segments: { flexDirection: "row", gap: 3 },
  segment: { flex: 1, height: 3, borderRadius: 1.5 },
  bar: { height: 3, borderRadius: 1.5, backgroundColor: TRACK, overflow: "hidden" },
  barFill: { height: 3, borderRadius: 1.5, backgroundColor: colors.onTint },
  title: { color: colors.onTint, fontWeight: "600", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4 },
});

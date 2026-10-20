import { Animated, StyleSheet, View } from "react-native";
import { spacing } from "@/ui/theme";

/** Instagram-style segments for the current day: done ones full, the current one fills with `progress`. */
export function ProgressBar({ count, current, progress }: { count: number; current: number; progress: Animated.Value }) {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              i < current
                ? { width: "100%" }
                : i === current
                  ? { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }
                  : { width: "0%" },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 3, paddingHorizontal: spacing.md },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" },
  fill: { height: 3, backgroundColor: "#fff" },
});

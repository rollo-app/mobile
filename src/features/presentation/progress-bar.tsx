import { useMemo } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { spacing } from "@/ui/theme";

/** Instagram-style segments for the current day: done ones full, the current one fills with `progress`. */
export function ProgressBar({ count, current, progress }: { count: number; current: number; progress: Animated.Value }) {
  // One animated position drives every segment, so none is ever a static width React could fail to update.
  const position = useMemo(() => Animated.add(new Animated.Value(current), progress), [current, progress]);
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                width: position.interpolate({ inputRange: [i, i + 1], outputRange: ["0%", "100%"], extrapolate: "clamp" }),
              },
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

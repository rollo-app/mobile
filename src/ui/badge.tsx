import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors } from "./theme";
import { useReduceMotion } from "./use-reduce-motion";

type Variant = "live" | "neutral";

/**
 * Small state capsule. `live` is system red with a pulsing white dot (still with Reduce Motion);
 * `neutral` is a translucent gray capsule with just the label. The hairline white border keeps it
 * readable over a tinted row.
 */
export function Badge({ variant, label }: { variant: Variant; label: string }) {
  const live = variant === "live";
  return (
    <View style={[styles.badge, live ? styles.live : styles.neutral]}>
      {live && <PulsingDot />}
      <Text style={[styles.label, { color: live ? "#FFFFFF" : colors.secondaryLabel }]}>{label}</Text>
    </View>
  );
}

const PULSE_MS = 800;

function PulsingDot() {
  const reduceMotion = useReduceMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion !== false) {
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: PULSE_MS, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, pulse]);

  const scale = pulse.interpolate({ inputRange: [0.35, 1], outputRange: [0.8, 1] });
  return <Animated.View testID="badge-dot" style={[styles.dot, { opacity: pulse, transform: [{ scale }] }]} />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.35)",
  },
  live: { backgroundColor: colors.danger },
  neutral: { backgroundColor: colors.fill },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" },
});

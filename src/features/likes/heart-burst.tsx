import { SymbolView } from "expo-symbols";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useReduceMotion } from "@/ui/use-reduce-motion";

const SIZE = 96;

/**
 * The heart that pops in the middle of a photo on a double tap and goes away. `burst` counts the double
 * taps: each new value plays it again; 0 shows nothing. With Reduce Motion it only fades.
 */
export function HeartBurst({ burst }: { burst: number }) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (burst === 0) return;
    opacity.value = withSequence(withTiming(1, { duration: 120 }), withDelay(450, withTiming(0, { duration: 220 })));
    if (reduceMotion === false) {
      scale.value = 0.4;
      scale.value = withSequence(withSpring(1.1, { damping: 9, stiffness: 260 }), withDelay(300, withTiming(0.9, { duration: 220 })));
    } else {
      scale.value = 1;
    }
  }, [burst, reduceMotion, opacity, scale]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));

  if (burst === 0) return null;
  return (
    <View pointerEvents="none" style={styles.center} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View testID="heart-burst" style={[styles.heart, style]}>
        <SymbolView name="heart.fill" size={SIZE} tintColor="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  heart: {
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
  },
});

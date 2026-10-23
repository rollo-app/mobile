import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, StyleSheet, Text, View } from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import { subscribePill } from "./pill";
import { useReduceMotion } from "./use-reduce-motion";

const IN_MS = 150;
const VISIBLE_MS = 1500;
const OUT_MS = 200;

/**
 * Renders the pill from `showPill`. On iOS it lives in a FullWindowOverlay (a window-level view),
 * so it shows above native modals such as the photo viewer.
 */
export function PillHost() {
  const [pill, setPill] = useState<{ text: string; id: number } | null>(null);
  const counter = useRef(0);
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(
    () =>
      subscribePill((text) => {
        counter.current += 1;
        setPill({ text, id: counter.current });
        AccessibilityInfo.announceForAccessibility(text);
      }),
    [],
  );

  const id = pill?.id;
  useEffect(() => {
    if (id === undefined) return;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: IN_MS, useNativeDriver: true }).start();
    const hide = setTimeout(() => {
      Animated.timing(progress, { toValue: 0, duration: OUT_MS, useNativeDriver: true }).start();
    }, IN_MS + VISIBLE_MS);
    const remove = setTimeout(() => setPill((p) => (p?.id === id ? null : p)), IN_MS + VISIBLE_MS + OUT_MS);
    return () => {
      clearTimeout(hide);
      clearTimeout(remove);
    };
  }, [id, progress]);

  const style = {
    opacity: progress,
    transform: [{ scale: reduceMotion ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
  };

  if (!pill) return null;
  const content = (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.pill, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.text}>{pill.text}</Text>
      </Animated.View>
    </View>
  );
  return Platform.OS === "ios" ? <FullWindowOverlay>{content}</FullWindowOverlay> : content;
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  pill: { backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  text: { color: "#fff", fontSize: 15, fontWeight: "600" },
});

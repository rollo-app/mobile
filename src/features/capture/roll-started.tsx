import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Presets } from "react-native-pulsar";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button } from "@/ui/components";
import { ownedTiming } from "@/ui/motion";
import { useReduceMotion } from "@/ui/use-reduce-motion";
import { colors, spacing, type } from "@/ui/theme";
import { RolloLockView, type LockPhase } from "../../../modules/rollo-symbol";
import { photosLeftText } from "./capture-copy";
import { useTodayLeft } from "./use-today-left";

const UNLOCK_AT = 400;
const CAMERA_AT = 900;
const TEXT_AT = 1500;
const ACTIONS_STAGGER = 60;
const BODY_LINE_HEIGHT = 22;

/**
 * The roll started. The lock wiggles, opens (rigid "clac") and turns into the camera
 * (bounce + success), then "Arrancó el rollo" with today's quota and the way to the first photo.
 */
export function RollStarted() {
  const insets = useSafeAreaInsets();
  const { trip } = useActiveTrip();
  const { detail } = useTripDetail(trip?.id);
  const left = useTodayLeft(trip?.id, detail);
  const [phase, setPhase] = useState<LockPhase>("locked");
  const reduceMotion = useReduceMotion();
  const [shown, setShown] = useState(false);
  const copy = useSharedValue(0);
  const actions = useSharedValue(0);

  useEffect(() => {
    // Unknown yet: wait, so the sequence never starts and then switches.
    if (reduceMotion === null) return;
    const timers = [
      setTimeout(() => {
        setPhase("unlocking");
        Presets.System.impactRigid();
      }, UNLOCK_AT),
      setTimeout(() => {
        setPhase("camera");
        Presets.System.notificationSuccess();
      }, CAMERA_AT),
      setTimeout(() => setShown(true), TEXT_AT),
    ];
    const timing = ownedTiming(300);
    copy.value = withDelay(TEXT_AT, withTiming(1, timing), ReduceMotion.Never);
    actions.value = withDelay(TEXT_AT + ACTIONS_STAGGER, withTiming(1, timing), ReduceMotion.Never);
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion, copy, actions]);

  const copyStyle = useAnimatedStyle(() => ({
    opacity: copy.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - copy.value) * 8 }],
  }));
  const actionsStyle = useAnimatedStyle(() => ({
    opacity: actions.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - actions.value) * 8 }],
  }));
  const hidden = {
    accessibilityElementsHidden: !shown,
    importantForAccessibility: shown ? ("auto" as const) : ("no-hide-descendants" as const),
  };

  const photos = left?.photos;
  const quota = photos === undefined ? null : photosLeftText(photos, detail?.trip.photoLimitMode);

  return (
    <View style={[styles.fill, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.center}>
        <RolloLockView
          phase={phase}
          size={96}
          tint={colors.label}
          style={styles.lock}
          accessible
          accessibilityLabel={phase === "camera" ? "Cámara" : "Candado"}
        />
        <Animated.View style={[styles.copy, copyStyle]} {...hidden}>
          <Text style={styles.title}>Arrancó el rollo.</Text>
          <View style={styles.bodySlot}>{quota ? <Text style={styles.body}>{quota}</Text> : null}</View>
        </Animated.View>
      </View>
      <Animated.View style={[styles.actions, actionsStyle]} pointerEvents={shown ? "auto" : "none"} {...hidden}>
        <Button label="Sacar la primera" onPress={() => router.replace("/capture")} />
        <Button label="Ahora no" variant="secondary" onPress={() => router.back()} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xl },
  lock: { width: 180, height: 180 },
  copy: { alignItems: "center", gap: spacing.xs },
  title: { ...type.title, color: colors.label, textAlign: "center" },
  bodySlot: { minHeight: BODY_LINE_HEIGHT },
  body: { ...type.body, lineHeight: BODY_LINE_HEIGHT, color: colors.secondaryLabel, textAlign: "center" },
  actions: { gap: spacing.sm },
});

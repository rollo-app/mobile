import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Presets } from "react-native-pulsar";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { RolloLockView, type LockPhase } from "../../../modules/rollo-symbol";
import { useTodayLeft } from "./use-today-left";

const UNLOCK_AT = 400;
const CAMERA_AT = 900;
const TEXT_AT = 1500;

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
  const text = useSharedValue(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => {
        setPhase("unlocking");
        Presets.System.impactRigid();
      }, UNLOCK_AT),
      setTimeout(() => {
        setPhase("camera");
        Presets.System.notificationSuccess();
      }, CAMERA_AT),
    ];
    text.value = withDelay(TEXT_AT, withTiming(1, { duration: 450 }));
    return () => timers.forEach(clearTimeout);
  }, [text]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: text.value,
    transform: [{ translateY: (1 - text.value) * 8 }],
  }));

  const photos = left?.photos;
  const quota = photos === undefined ? null : photos === 1 ? "Tenés 1 foto hoy." : `Tenés ${photos} fotos hoy.`;

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
        <Animated.View style={[styles.copy, textStyle]}>
          <Text style={styles.title}>Arrancó el rollo.</Text>
          {quota ? <Text style={styles.body}>{quota}</Text> : null}
        </Animated.View>
      </View>
      <Animated.View style={[styles.actions, textStyle]}>
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
  body: { ...type.body, color: colors.secondaryLabel, textAlign: "center" },
  actions: { gap: spacing.sm },
});

import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Presets } from "react-native-pulsar";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { ownedTiming } from "@/ui/motion";
import { spacing, type } from "@/ui/theme";
import { useReduceMotion } from "@/ui/use-reduce-motion";
import { formatLeft } from "./moment-time";
import { momentIntroTiming } from "./moment-intro-timing";

const FADE_MS = 300;

/**
 * The signature before the daily moment's camera: the logo assembles and a ring draws around it (the window), with
 * the time left under it. It ends by itself (or on tap): it never makes anyone wait.
 */
export function MomentIntro({ leftMs, onDone }: { leftMs: number; onDone: () => void }) {
  const reduceMotion = useReduceMotion();
  const timing = momentIntroTiming(reduceMotion);
  // The time is static: the countdown lives in the camera.
  const [left] = useState(() => formatLeft(leftMs));
  const text = useSharedValue(0);
  const done = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  function finish() {
    if (done.current) return;
    done.current = true;
    onDoneRef.current();
  }

  const { hapticAt, textAt, doneAt } = timing;
  useEffect(() => {
    // Wait for Reduce Motion to be known so the animation never starts and then switches.
    if (reduceMotion === null) return;
    const timers = [setTimeout(() => Presets.System.impactRigid(), hapticAt), setTimeout(finish, doneAt)];
    text.set(withDelay(textAt, withTiming(1, ownedTiming(FADE_MS)), ReduceMotion.Never));
    return () => timers.forEach(clearTimeout);
    // `text` and `finish` are stable in practice; the timers must not restart when the fade re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, hapticAt, textAt, doneAt]);

  const reduced = !timing.playLottie;
  const textStyle = useAnimatedStyle(() => ({
    opacity: text.value,
    transform: reduced ? [] : [{ translateY: (1 - text.value) * 8 }],
  }));

  return (
    <Pressable
      style={styles.fill}
      onPress={finish}
      accessibilityRole="button"
      accessibilityLabel={`Tu momento. Te quedan ${left}. Tocá para abrir la cámara.`}
    >
      {reduceMotion === null ? null : (
        <Animated.View style={[styles.center, reduced ? textStyle : null]}>
          <LottieView
            source={require("../../../assets/lottie/moment-intro.json")}
            style={styles.lottie}
            autoPlay={timing.playLottie}
            loop={false}
            progress={timing.playLottie ? undefined : 1}
          />
          <Animated.View style={[styles.copy, reduced ? null : textStyle]}>
            <Text style={styles.title}>Tu momento</Text>
            <Text style={styles.subtitle}>{`Te quedan ${left}`}</Text>
          </Animated.View>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", gap: spacing.md },
  lottie: { width: 220, height: 220 },
  copy: { alignItems: "center", gap: spacing.xs },
  title: { ...type.title, color: "#fff", textAlign: "center" },
  subtitle: { ...type.body, color: "rgba(255,255,255,0.75)", textAlign: "center" },
});

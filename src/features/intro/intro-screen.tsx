import { router } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { markWelcomeIntroSeen } from "@/storage/welcome-intro";
import { Button } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { useReduceMotion } from "@/ui/use-reduce-motion";
import { introTiming } from "./intro-timing";

const FADE_MS = 400;
const MARK_SIZE = 200;

/**
 * The app's first presentation, once per phone for a new account: the logo assembles, the tagline appears and a
 * button leads into the app. Calm: no haptics, no sound.
 */
export function IntroScreen() {
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === "dark";
  const reduceMotion = useReduceMotion();
  const timing = introTiming(reduceMotion);
  const [buttonShown, setButtonShown] = useState(false);
  const first = useSharedValue(0);
  const second = useSharedValue(0);
  const button = useSharedValue(0);

  // The welcome's small logo must not animate again right after this.
  useEffect(() => {
    markWelcomeIntroSeen().catch(() => {});
  }, []);

  const { firstLineAt, secondLineAt, buttonAt } = timing;
  useEffect(() => {
    // Wait for Reduce Motion to be known so the sequence never starts and then switches.
    if (reduceMotion === null) return;
    const fade = { duration: FADE_MS, easing: Easing.bezier(0.23, 1, 0.32, 1) };
    first.set(withDelay(firstLineAt, withTiming(1, fade)));
    second.set(withDelay(secondLineAt, withTiming(1, fade)));
    button.set(withDelay(buttonAt, withTiming(1, fade)));
    const timer = setTimeout(() => setButtonShown(true), buttonAt);
    return () => clearTimeout(timer);
    // The shared values are stable; the timer must not restart when they re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, firstLineAt, secondLineAt, buttonAt]);

  const moves = timing.moves;
  // Called from the animated styles below, on the UI thread: it must be a worklet.
  const lineStyle = (value: { value: number }) => {
    "worklet";
    return { opacity: value.value, transform: moves ? [{ translateY: (1 - value.value) * 8 }] : [] };
  };
  const firstStyle = useAnimatedStyle(() => lineStyle(first));
  const secondStyle = useAnimatedStyle(() => lineStyle(second));
  const buttonStyle = useAnimatedStyle(() => ({ opacity: button.value }));

  if (reduceMotion === null) return <View style={styles.fill} />;

  return (
    <View style={[styles.fill, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.center}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <LottieView
            source={
              dark ? require("../../../assets/lottie/app-intro-dark.json") : require("../../../assets/lottie/app-intro-light.json")
            }
            style={styles.mark}
            autoPlay={timing.playLottie}
            loop={false}
            progress={timing.playLottie ? undefined : 1}
          />
        </View>
        <View style={styles.copy}>
          <Animated.View style={firstStyle}>
            <Text style={styles.title}>Sacá la foto.</Text>
          </Animated.View>
          <Animated.View style={secondStyle}>
            <Text style={styles.title}>Mirala después.</Text>
          </Animated.View>
        </View>
      </View>
      <Animated.View
        style={[styles.actions, buttonStyle]}
        pointerEvents={buttonShown ? "auto" : "none"}
        accessibilityElementsHidden={!buttonShown}
        importantForAccessibility={buttonShown ? "auto" : "no-hide-descendants"}
      >
        <Button label="Empezar" onPress={() => router.back()} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  // A bit above the center: the bottom has the button.
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  mark: { width: MARK_SIZE, height: MARK_SIZE },
  copy: { alignItems: "center", gap: spacing.xs },
  title: { ...type.title, color: colors.label, textAlign: "center" },
  actions: {},
});

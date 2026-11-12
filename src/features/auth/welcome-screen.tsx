import { router } from "expo-router";
import LottieView from "lottie-react-native";
import { Keyboard, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRegistrationsOpen } from "@/features/waitlist/use-config";
import { WaitlistForm } from "@/features/waitlist/waitlist-form";
import { Button } from "@/ui/components";
import { useKeyboardLift } from "@/ui/keyboard-lift";
import { colors, spacing, type } from "@/ui/theme";

const MARK_SIZE = 120;

/**
 * First screen for someone logged out, and what everybody sees while registrations are closed (then it has the
 * waitlist form instead of "Crear cuenta"). Logging in is the same email screen either way: it creates the
 * account when there isn't one.
 */
export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === "dark";
  const open = useRegistrationsOpen();
  const toEmail = () => router.push("/email");
  // Actions sit on the bottom margin and ride up with the keyboard.
  const lift = useKeyboardLift(insets.bottom, spacing.md, spacing.md);

  return (
    // Tapping anywhere outside the field hides the keyboard. Not a button for VoiceOver, which has its own way to dismiss it.
    <Pressable style={styles.fill} onPress={Keyboard.dismiss} accessible={false}>
      <Animated.View style={[styles.screen, lift, { paddingTop: insets.top + spacing.xl * 2 }]}>
        <View style={styles.copy}>
          {/* Decorative, the last frame of the intro logo: the title already says it. */}
          <View style={styles.mark} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <LottieView
              source={dark ? require("../../../assets/lottie/logo-intro-dark.json") : require("../../../assets/lottie/logo-intro-light.json")}
              style={styles.mark}
              autoPlay={false}
              loop={false}
              progress={1}
            />
          </View>
          <Text style={[type.largeTitle, styles.center, { color: colors.label }]}>Rollo</Text>
          {open ? (
            <Text style={[type.body, styles.center, { color: colors.secondaryLabel }]}>
              Sacá fotos con tu grupo y mirálas todas juntas al final, como un rollo.
            </Text>
          ) : (
            <Text style={[type.body, styles.center, { color: colors.secondaryLabel }]}>
              Estamos abriendo Rollo de a poco. Dejanos tu email y te avisamos cuando puedas entrar.
            </Text>
          )}
        </View>
        <View style={styles.actions}>
          {open ? <Button label="Crear cuenta" onPress={toEmail} /> : <WaitlistForm />}
          <Pressable accessibilityRole="button" accessibilityLabel="Ya tengo cuenta" onPress={toEmail} hitSlop={8} style={styles.login}>
            {({ pressed }) => <Text style={[type.body, { color: colors.tint, opacity: pressed ? 0.7 : 1 }]}>Ya tengo cuenta</Text>}
          </Pressable>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flex: 1, justifyContent: "space-between", paddingHorizontal: spacing.lg, backgroundColor: colors.background },
  copy: { gap: spacing.sm, alignItems: "center", paddingHorizontal: spacing.md, minHeight: 0 },
  mark: { width: MARK_SIZE, height: MARK_SIZE, marginBottom: spacing.md },
  center: { textAlign: "center" },
  actions: { gap: spacing.md },
  login: { alignSelf: "center", paddingVertical: spacing.sm },
});

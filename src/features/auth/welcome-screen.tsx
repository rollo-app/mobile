import { router } from "expo-router";
import LottieView from "lottie-react-native";
import { ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRegistrationsOpen } from "@/features/waitlist/use-config";
import { WaitlistForm } from "@/features/waitlist/waitlist-form";
import { Button } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";

const MARK_SIZE = 96;

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

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}
    >
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
        <Button label="Ya tengo cuenta" variant="secondary" onPress={toEmail} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: "center", gap: spacing.xl, padding: spacing.lg },
  copy: { gap: spacing.sm, alignItems: "center" },
  mark: { width: MARK_SIZE, height: MARK_SIZE },
  center: { textAlign: "center" },
  actions: { gap: spacing.md },
});

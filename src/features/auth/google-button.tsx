import { ActivityIndicator, Image, Pressable, StyleSheet, Text, useColorScheme } from "react-native";
import { radius, spacing, type } from "@/ui/theme";

/**
 * Google's own button colors (Sign in with Google branding guidelines): light in light mode, dark in dark mode. They are not ours
 * to change (no cobalt, no red), so they are fixed hex values instead of theme colors.
 */
export const GOOGLE_BUTTON_THEMES = {
  light: { background: "#FFFFFF", border: "#747775", text: "#1F1F1F" },
  dark: { background: "#131314", border: "#8E918F", text: "#E3E3E3" },
} as const;

/** Same height as `Button` and the Apple button, so the three stack as a set. */
const HEIGHT = 50;
const LOGO = 18;

/** "Continuar con Google" with Google's standard "G" mark (assets/google-g*.png, never recolored). */
export function GoogleSignInButton({ onPress, disabled, loading }: { onPress: () => void; disabled?: boolean; loading?: boolean }) {
  const theme = GOOGLE_BUTTON_THEMES[useColorScheme() === "dark" ? "dark" : "light"];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continuar con Google"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.background, borderColor: theme.border, opacity: disabled && !loading ? 0.35 : pressed ? 0.7 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.text} style={styles.logo} />
      ) : (
        <Image testID="google-logo" source={require("../../../assets/google-g.png")} style={styles.logo} accessible={false} />
      )}
      <Text style={[type.headline, { color: theme.text }]}>Continuar con Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: HEIGHT,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  logo: { width: LOGO, height: LOGO },
});

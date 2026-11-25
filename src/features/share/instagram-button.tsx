import { Image, Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, type } from "@/ui/theme";

const LOGO = 28;

/** "Compartir en Instagram" with Instagram's mark (assets/share/instagram.png, never recolored). Same look as `Button`; the logo sits at the left of the text. */
export function InstagramButton({ onPress, disabled, variant = "primary" }: { onPress: () => void; disabled?: boolean; variant?: "primary" | "secondary" }) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Compartir en Instagram"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: primary ? colors.tint : colors.fill, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 }]}
    >
      <Image testID="instagram-logo" source={require("../../../assets/share/instagram.png")} style={styles.logo} accessible={false} />
      <Text style={[type.headline, { color: primary ? colors.onTint : colors.label }]}>Compartir en Instagram</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radius.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  logo: { width: LOGO, height: LOGO },
});

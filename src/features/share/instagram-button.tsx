import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "@/ui/theme";

const LOGO = 28;
const TILE = 32;

/** "Compartir en Instagram" with Instagram's mark (assets/share/instagram.png, never recolored). Same look as `Button`; the logo sits at the left of the text. */
export function InstagramButton({ onPress, disabled, variant = "primary" }: { onPress: () => void; disabled?: boolean; variant?: "primary" | "secondary" }) {
  const primary = variant === "primary";
  const logo = <Image testID="instagram-logo" source={require("../../../assets/share/instagram.png")} style={styles.logo} accessible={false} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Compartir en Instagram"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: primary ? colors.tint : colors.fill, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 }]}
    >
      {primary ? (
        // The gradient glyph vanishes on the cobalt button: it sits on a small white tile, like an app icon.
        <View testID="instagram-logo-tile" style={styles.tile}>
          {logo}
        </View>
      ) : (
        logo
      )}
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
  tile: { width: TILE, height: TILE, borderRadius: 8, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  logo: { width: LOGO, height: LOGO },
});

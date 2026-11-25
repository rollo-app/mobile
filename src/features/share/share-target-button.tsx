import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/ui/theme";
import type { ShareOption } from "./share-options";

const CIRCLE = 60;
const LOGO = 32;
const SYMBOL = 26;

const LOGOS = {
  whatsapp: require("../../../assets/share/whatsapp.png"),
  instagram: require("../../../assets/share/instagram.png"),
} as const;

/** A circular share target (icon in a neutral circle, label below) for the "Compartir" sheet. */
export function ShareTargetButton({ option, label, busy = false, onPress }: { option: ShareOption; label: string; busy?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={busy ? { busy: true, disabled: true } : undefined}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.target, pressed && styles.pressed]}
    >
      <View style={styles.circle}>
        {busy ? (
          <ActivityIndicator />
        ) : option === "link" ? (
          <SymbolView name="link" size={SYMBOL} tintColor={colors.label} />
        ) : (
          <Image source={LOGOS[option]} style={styles.logo} accessible={false} />
        )}
      </View>
      <Text numberOfLines={1} style={[type.footnote, styles.label]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { alignItems: "center", gap: spacing.sm },
  pressed: { opacity: 0.6 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: colors.fill, alignItems: "center", justifyContent: "center" },
  logo: { width: LOGO, height: LOGO },
  label: { color: colors.label, textAlign: "center" },
});

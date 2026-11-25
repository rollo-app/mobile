import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/ui/theme";
import type { ShareOption } from "./share-options";

const CIRCLE = 60;
const LOGO = 32;
const SYMBOL = 26;

/** What a target can show: the sheet's options plus the symbols the "Compartir" screen uses. */
export type ShareTargetIcon = ShareOption | "more" | "photos";

const SYMBOLS = { link: "link", more: "ellipsis", photos: "photo.on.rectangle.angled" } as const;

const LOGOS = {
  whatsapp: require("../../../assets/share/whatsapp.png"),
  instagram: require("../../../assets/share/instagram.png"),
} as const;

/** A circular share target (icon in a neutral circle, label below) for the "Compartir" sheet. */
export function ShareTargetButton({
  option,
  label,
  busy = false,
  disabled = false,
  onPress,
}: {
  option: ShareTargetIcon;
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={busy ? { busy: true, disabled: true } : disabled ? { disabled: true } : undefined}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.target, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <View style={styles.circle}>
        {busy ? (
          <ActivityIndicator />
        ) : option === "link" || option === "more" || option === "photos" ? (
          <SymbolView name={SYMBOLS[option]} size={SYMBOL} tintColor={colors.label} />
        ) : (
          <Image testID={option === "instagram" ? "instagram-logo" : undefined} source={LOGOS[option]} style={styles.logo} accessible={false} />
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
  disabled: { opacity: 0.35 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: colors.fill, alignItems: "center", justifyContent: "center" },
  logo: { width: LOGO, height: LOGO },
  label: { color: colors.label, textAlign: "center" },
});

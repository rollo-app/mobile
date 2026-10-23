import { SymbolView } from "expo-symbols";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { spacing } from "./theme";

export type SymbolName = ComponentProps<typeof SymbolView>["name"];

/** Round dark button for the corners of a full-screen black viewer (the ✕, the ⋯). */
export const overlayCorner: ViewStyle = {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: "rgba(0,0,0,0.45)",
  alignItems: "center",
  justifyContent: "center",
};

/** The ✕ / ⋯ symbol inside an `overlayCorner`. */
export function OverlayCornerSymbol({ name }: { name: SymbolName }) {
  return <SymbolView name={name} size={16} weight="semibold" tintColor="#FFFFFF" />;
}

/** The ⋯ trigger of a viewer's menu, drawn like the ✕ in the opposite corner. */
export function OverlayMoreButton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityLabel="Más opciones" accessibilityRole="button" style={[overlayCorner, style]}>
      <OverlayCornerSymbol name="ellipsis" />
    </View>
  );
}

/**
 * Icon-only action for the bottom panel of a black viewer: no pill, no text (the label is for VoiceOver).
 * `children` go right after the icon (a count). `busy` swaps the icon for a spinner.
 */
export function OverlayIconButton({
  symbol,
  label,
  onPress,
  tint = "#FFFFFF",
  disabled,
  busy,
  value,
  symbolTestID,
  children,
}: {
  symbol: SymbolName;
  label: string;
  onPress: () => void;
  tint?: string;
  disabled?: boolean;
  busy?: boolean;
  value?: { text: string };
  symbolTestID?: string;
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={value}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {busy ? (
        <View style={styles.icon}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : (
        <SymbolView testID={symbolTestID} name={symbol} size={22} tintColor={tint} style={styles.icon} />
      )}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minWidth: 44, height: 44 },
  icon: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.5 },
});

import { Pressable, StyleSheet, Text } from "react-native";
import { colors, type } from "@/ui/theme";

const HEIGHT = 40;

/** Compact "Reintentar" pill, in the style of the screen's secondary pills. */
export function RetryPill({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Reintentar" onPress={onPress} style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
      <Text style={[type.footnote, styles.label]}>Reintentar</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { height: HEIGHT, paddingHorizontal: 18, borderRadius: HEIGHT / 2, alignItems: "center", justifyContent: "center", backgroundColor: colors.fill },
  label: { fontWeight: "600", color: colors.label },
  pressed: { opacity: 0.6 },
});

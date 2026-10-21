import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/ui/theme";

/** What Mapa and Feed show when there is no roll to look at: a calm pointer to the Rollo tab. */
export function NoRollYet() {
  return (
    <View style={styles.screen}>
      <Text style={[type.title, styles.center, { color: colors.label }]}>Primero hace falta un rollo</Text>
      <Text style={[type.body, styles.center, { color: colors.secondaryLabel }]}>
        Empezá uno o sumate con un código desde la pestaña Rollo.
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Ir a Rollo" onPress={() => router.navigate("/roll")}>
        <Text style={[type.headline, { color: colors.tint }]}>Ir a Rollo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  center: { textAlign: "center" },
});

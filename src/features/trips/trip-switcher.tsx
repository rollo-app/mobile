import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, useWindowDimensions } from "react-native";
import { colors, spacing, type } from "@/ui/theme";

/** Header title with the active trip's name; opens the trip selector. `maxWidthRatio` is the share of the screen it may take. */
export function TripSwitcher({ name, maxWidthRatio = 0.5 }: { name: string; maxWidthRatio?: number }) {
  const { width } = useWindowDimensions();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, cambiar de rollo`}
      onPress={() => router.push("/trips")}
      style={({ pressed }) => [styles.switcher, { maxWidth: width * maxWidthRatio, opacity: pressed ? 0.6 : 1 }]}
    >
      <Text numberOfLines={1} style={[type.headline, styles.name, { color: colors.label }]}>
        {name}
      </Text>
      <SymbolView name="chevron.down" size={12} weight="bold" tintColor={colors.tint as string} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switcher: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: { flexShrink: 1 },
});

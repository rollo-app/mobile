import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, spacing, type } from "@/ui/theme";

/** Título del header con el nombre del viaje activo; abre el selector de viajes. */
export function TripSwitcher({ name }: { name: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, cambiar de viaje`}
      onPress={() => router.push("/trips")}
      style={({ pressed }) => [styles.switcher, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text numberOfLines={1} style={[type.headline, { color: colors.label }]}>
        {name}
      </Text>
      <SymbolView name="chevron.down" size={12} weight="bold" tintColor={colors.tint as string} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switcher: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
});

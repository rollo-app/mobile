import { Redirect, router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { Button } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";

export default function IndexScreen() {
  const { trip, loaded } = useActiveTrip();
  const insets = useSafeAreaInsets();

  if (!loaded) return null;
  if (trip) return <Redirect href="/roll" />;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl * 2, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.copy}>
        <Text style={[type.largeTitle, { color: colors.label }]}>Rollo</Text>
        <Text style={[type.body, { color: colors.secondaryLabel }]}>
          Cada uno saca fotos y nadie las ve hasta el revelado, ni las propias.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="Empezar un nuevo rollo" onPress={() => router.push("/create")} />
        <Button label="Sumate con un código" variant="secondary" onPress={() => router.push("/join")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  copy: { gap: spacing.sm },
  actions: { gap: spacing.sm },
});

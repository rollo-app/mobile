import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { setActiveTripId } from "@/storage/active-trip";
import { Button, Screen } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";

/** Trip selector (sheet). The chosen one becomes the active one. */
export default function TripsScreen() {
  const { trip: active, trips } = useActiveTrip();

  async function select(tripId: string) {
    await setActiveTripId(tripId);
    router.dismissTo("/roll");
  }

  return (
    <Screen grouped>
      <View style={styles.group}>
        {trips.map((t, i) => (
          <Fragment key={t.id}>
            {i > 0 && <View style={styles.separator} />}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.name}
              accessibilityState={{ selected: t.id === active?.id }}
              onPress={() => select(t.id)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}
            >
              <View style={styles.text}>
                <Text style={[type.body, { color: colors.label }]}>{t.name}</Text>
                <Text style={[type.footnote, { color: colors.secondaryLabel }]}>
                  {t.role === "admin" ? "Lo creaste vos" : "Entraste con un código"}
                </Text>
              </View>
              {t.id === active?.id && (
                <SymbolView name="checkmark" size={16} weight="semibold" tintColor={colors.tint as string} />
              )}
            </Pressable>
          </Fragment>
        ))}
      </View>

      <View style={styles.actions}>
        <Button label="Empezar un nuevo rollo" onPress={() => router.replace("/create")} />
        <Button label="Sumate con un código" variant="secondary" onPress={() => router.replace("/join")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.cell, borderRadius: radius.lg, borderCurve: "continuous", overflow: "hidden" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: spacing.md },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 11, gap: spacing.sm },
  text: { flex: 1, gap: 2 },
  actions: { gap: spacing.sm },
});

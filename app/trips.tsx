import { router } from "expo-router";
import { Fragment } from "react";
import { StyleSheet, View } from "react-native";
import { TripRow } from "@/features/trips/trip-row";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { setActiveTripId } from "@/storage/active-trip";
import { Button, Screen } from "@/ui/components";
import { colors, radius, spacing } from "@/ui/theme";

/** Trip selector (sheet). The chosen one becomes the active one. */
export default function TripsScreen() {
  const { trip: active, trips } = useActiveTrip();
  const now = Date.now();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
            <TripRow
              trip={t}
              selected={t.id === active?.id}
              now={now}
              timeZone={timeZone}
              onPress={() => select(t.id)}
            />
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
  actions: { gap: spacing.sm },
});

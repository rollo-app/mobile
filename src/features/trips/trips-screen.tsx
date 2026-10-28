import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { setActiveTripId } from "@/storage/active-trip";
import { Button, Screen, Section } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";
import { groupTrips } from "./group-trips";
import { TripRow } from "./trip-row";
import { useActiveTrip } from "./use-active-trip";

/** Trip selector (sheet). The chosen one becomes the active one. */
export function TripsScreen() {
  const { trip: active, trips } = useActiveTrip();
  const now = Date.now();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const groups = groupTrips(trips, now, active?.id ?? null);

  async function select(tripId: string) {
    await setActiveTripId(tripId);
    router.dismissTo("/roll");
  }

  const row = (t: (typeof trips)[number]) => (
    <TripRow key={t.id} trip={t} selected={t.id === active?.id} now={now} timeZone={timeZone} onPress={() => select(t.id)} />
  );

  return (
    <Screen grouped>
      {groups.top.length > 0 && <Group>{groups.top.map(row)}</Group>}
      {groups.revealed.length > 0 && <Section title="Revelados">{groups.revealed.map(row)}</Section>}
      {groups.older.length > 0 && (
        <OlderRolls count={groups.older.length} initiallyOpen={groups.olderExpandedByDefault}>
          {groups.older.map(row)}
        </OlderRolls>
      )}

      <View style={styles.actions}>
        <Button label="Empezar un nuevo rollo" onPress={() => router.replace("/create")} />
        <Button label="Sumate con un código" variant="secondary" onPress={() => router.replace("/join")} />
      </View>
    </Screen>
  );
}

function Group({ children }: { children: ReactNode }) {
  const rows = Array.isArray(children) ? children : [children];
  return (
    <View style={styles.group}>
      {rows.map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <View style={styles.separator} />}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

/** "Anteriores · N": a disclosure row that opens the rolls revealed long ago inline. Remembers nothing. */
function OlderRolls({ count, initiallyOpen, children }: { count: number; initiallyOpen: boolean; children: ReactNode[] }) {
  // The saved active id loads after the first render, so the default follows the data until the user taps.
  const [chosen, setChosen] = useState<boolean | null>(null);
  const open = chosen ?? initiallyOpen;
  const turn = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(turn, { toValue: open ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [open, turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] });

  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Anteriores, ${count}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setChosen(!open)}
        style={({ pressed }) => [styles.disclosure, pressed && { backgroundColor: colors.fill }]}
      >
        <Text style={[type.body, styles.disclosureLabel, { color: colors.label }]}>{`Anteriores · ${count}`}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={colors.tertiaryLabel as string} />
        </Animated.View>
      </Pressable>
      {open &&
        children.map((child, i) => (
          <Fragment key={i}>
            <View style={styles.separator} />
            {child}
          </Fragment>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.cell, borderRadius: radius.lg, borderCurve: "continuous", overflow: "hidden" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: spacing.md },
  disclosure: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 13, gap: spacing.sm },
  disclosureLabel: { flex: 1 },
  actions: { gap: spacing.sm },
});

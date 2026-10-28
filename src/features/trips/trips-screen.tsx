import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { setActiveTripId } from "@/storage/active-trip";
import { Button, Screen, Section } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";
import { useLeaveTrip } from "@/features/friends/use-leave-trip";
import type { TripSummary } from "./active";
import { groupTrips } from "./group-trips";
import { rowActions, type RowActionId } from "./row-actions";
import { useArchiveTrip } from "./use-archive-trip";
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

  const { setArchived } = useArchiveTrip();
  const row = (t: TripSummary) => (
    <ActionableRow key={t.id} trip={t} selected={t.id === active?.id} now={now} timeZone={timeZone} onPress={() => select(t.id)} setArchived={setArchived} />
  );

  return (
    <Screen grouped>
      {groups.top.length > 0 && <Group>{groups.top.map(row)}</Group>}
      {groups.revealed.length > 0 && <Section title="Revelados">{groups.revealed.map(row)}</Section>}
      {groups.older.length > 0 && (
        <FoldedRolls label="Anteriores" count={groups.older.length} initiallyOpen={groups.olderExpandedByDefault}>
          {groups.older.map(row)}
        </FoldedRolls>
      )}
      {groups.archived.length > 0 && (
        <FoldedRolls label="Archivados" count={groups.archived.length} initiallyOpen={groups.archivedExpandedByDefault}>
          {groups.archived.map(row)}
        </FoldedRolls>
      )}

      <View style={styles.actions}>
        <Button label="Empezar un nuevo rollo" onPress={() => router.replace("/create")} />
        <Button label="Sumate con un código" variant="secondary" onPress={() => router.replace("/join")} />
      </View>
    </Screen>
  );
}

/** A row with its actions; leaving needs the hook per roll, so this is a component of its own. */
function ActionableRow({
  trip,
  setArchived,
  ...rest
}: {
  trip: TripSummary;
  selected: boolean;
  now: number;
  timeZone: string;
  onPress: () => void;
  setArchived: (tripId: string, archived: boolean) => void;
}) {
  const leave = useLeaveTrip(trip.id, trip.name, { revealed: trip.revealed, copy: "list" });
  const onAction = (id: RowActionId) => {
    if (id === "leave") leave.confirm();
    else setArchived(trip.id, id === "archive");
  };
  return <TripRow trip={trip} actions={rowActions(trip)} onAction={onAction} {...rest} />;
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

/** "Anteriores · N" / "Archivados · N": a disclosure row that opens those rolls inline. Remembers nothing. */
function FoldedRolls({ label, count, initiallyOpen, children }: { label: string; count: number; initiallyOpen: boolean; children: ReactNode[] }) {
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
        accessibilityLabel={`${label}, ${count}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setChosen(!open)}
        style={({ pressed }) => [styles.disclosure, pressed && { backgroundColor: colors.fill }]}
      >
        <Text style={[type.body, styles.disclosureLabel, { color: colors.label }]}>{`${label} · ${count}`}</Text>
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

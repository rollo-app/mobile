import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { setActiveTripId } from "@/storage/active-trip";
import { Welcome } from "@/features/roll/welcome";
import { Button, ErrorText, Loading, Screen, Section } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";
import { useLeaveTrip } from "@/features/friends/use-leave-trip";
import { hasNoTrips, type TripSummary } from "./active";
import { groupTrips } from "./group-trips";
import { LiveRollCard } from "./live-roll-card";
import { rollHref } from "./roll-href";
import { rowActions, type RowActionId } from "./row-actions";
import { useArchiveTrip } from "./use-archive-trip";
import { TripRow } from "./trip-row";
import { useActiveTrip } from "./use-active-trip";

/** Root of the Rollos tab: your rolls. Tapping one pushes it (the roll marks itself as the active one once it mounts). */
export function RollsScreen() {
  const { trip: active, trips, loaded, error, refetch } = useActiveTrip();
  const now = Date.now();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const groups = groupTrips(trips, now, active?.id ?? null);
  const { setArchived } = useArchiveTrip();

  if (hasNoTrips(loaded, active)) return <Welcome />;
  if (error) {
    return (
      <Screen grouped>
        <ErrorText>{error}</ErrorText>
        <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} />
      </Screen>
    );
  }
  if (!loaded) return <Loading />;

  const open = (id: string) => router.push(rollHref(id));
  const row = (t: TripSummary) => (
    <ActionableRow key={t.id} trip={t} now={now} timeZone={timeZone} onPress={() => open(t.id)} setArchived={setArchived} />
  );

  return (
    <Screen grouped>
      <Stack.Screen options={{ title: "Rollos", headerLargeTitle: true }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="plus" accessibilityLabel="Nuevo rollo o sumarte">
          <Stack.Toolbar.MenuAction icon="plus.circle" onPress={() => router.push("/create")}>
            Nuevo rollo
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction icon="number" onPress={() => router.push("/join")}>
            Sumate con un código
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      {groups.live.map((t) => (
        <LiveRollCard
          key={t.id}
          trip={t}
          onOpen={() => open(t.id)}
          onCamera={async () => {
            await setActiveTripId(t.id);
            router.push("/capture");
          }}
        />
      ))}
      {groups.top.length > 0 && <Section title="Próximos">{groups.top.map(row)}</Section>}
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
});

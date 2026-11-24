import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { SelectionHeaderTitle } from "@/features/gallery/selection-header-title";
import type { ColorValue } from "react-native";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useRollPhase } from "@/features/trips/use-roll-phase";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { setActiveTripId } from "@/storage/active-trip";
import { colors } from "@/ui/theme";
import { RevealedRollScreen } from "./revealed-roll-screen";
import { RollBoard } from "./roll-board";

/** After the reveal the Rollo tab is "Galería | Rollo"; before, the board. */
export function RollScreen({ tripId, view }: { tripId: string; view?: string }) {
  const { trips, loaded } = useActiveTrip();
  const trip = trips.find((t) => t.id === tripId);
  const { detail } = useTripDetail(tripId);
  const phase = useRollPhase(detail);
  // While the gallery is selecting, the title is the selection: the trip's name doesn't fit between its two buttons.
  const [selection, setSelection] = useState<number | null>(null);
  // Opening a roll makes it the active one (capture, map and feed follow it).
  useEffect(() => {
    void setActiveTripId(tripId);
  }, [tripId]);
  // A roll that isn't in your list (left, deleted, stale link) goes back to the list.
  const unknown = loaded && !trip;
  useEffect(() => {
    if (unknown) router.replace("/roll");
  }, [unknown]);
  const revealed = trip && phase === "revealed";
  const selecting = revealed && view !== "roll" && selection !== null;
  // Revealed, the header is solid with the screen's background so it reads as one block with the
  // "Galería | Rollo" row under it. Set here (not in the revealed screen) so that switching to a trip
  // that isn't revealed clears them: undefined goes back to the stack's default header.
  const header = revealed ? solidHeader(view === "roll" ? colors.groupedBackground : colors.background) : defaultHeader;
  return (
    <>
      {trip && (
        <Stack.Screen
          options={{
            ...header,
            title: trip.name,
            headerTitle: selecting ? () => <SelectionHeaderTitle count={selection} /> : undefined,
          }}
        />
      )}
      {/* "Ajustes del rollo": on the board and in the revealed "Rollo" view; the gallery has its own toolbar. */}
      {trip && (!revealed || view === "roll") && <SettingsButton tripId={trip.id} />}
      {revealed ? <RevealedRollScreen tripId={tripId} onSelectionChange={setSelection} /> : <RollBoard tripId={tripId} />}
    </>
  );
}

function SettingsButton({ tripId }: { tripId: string }) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        icon="gearshape"
        accessibilityLabel="Ajustes del rollo"
        onPress={() => router.push({ pathname: "/roll-settings", params: { tripId } })}
      />
    </Stack.Toolbar>
  );
}

const solidHeader = (backgroundColor: ColorValue) => ({
  headerTransparent: false,
  headerStyle: { backgroundColor },
  headerShadowVisible: false,
  headerBlurEffect: "none" as const,
  headerLargeTitle: false,
});

const defaultHeader = {
  headerTransparent: undefined,
  headerStyle: undefined,
  headerShadowVisible: undefined,
  headerBlurEffect: undefined,
  headerLargeTitle: undefined,
};

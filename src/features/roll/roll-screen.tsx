import { Stack } from "expo-router";
import { useState } from "react";
import { SelectionHeaderTitle } from "@/features/gallery/selection-header-title";
import type { ColorValue } from "react-native";
import { hasNoTrips } from "@/features/trips/active";
import { TripSwitcher } from "@/features/trips/trip-switcher";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useRollPhase } from "@/features/trips/use-roll-phase";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { colors } from "@/ui/theme";
import { RevealedRollScreen } from "./revealed-roll-screen";
import { RollBoard } from "./roll-board";
import { Welcome } from "./welcome";

/** After the reveal the Rollo tab is "Galería | Rollo"; before, the board. */
export function RollScreen({ view }: { view?: string }) {
  const { trip, loaded } = useActiveTrip();
  const { detail } = useTripDetail(trip?.id);
  const phase = useRollPhase(detail);
  // While the gallery is selecting, the title is the selection: the trip's name doesn't fit between its two buttons.
  const [selection, setSelection] = useState<number | null>(null);
  if (hasNoTrips(loaded, trip)) return <Welcome />;
  const revealed = trip && phase === "revealed";
  const selecting = revealed && view !== "roll" && selection !== null;
  // The gallery's right toolbar (select + menu) is wider, so its title gets less room.
  const maxWidthRatio = revealed && view !== "roll" ? 0.45 : 0.5;
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
            headerTitle: () =>
              selecting ? <SelectionHeaderTitle count={selection} /> : <TripSwitcher name={trip.name} maxWidthRatio={maxWidthRatio} />,
          }}
        />
      )}
      {revealed ? <RevealedRollScreen tripId={trip.id} onSelectionChange={setSelection} /> : <RollBoard />}
    </>
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

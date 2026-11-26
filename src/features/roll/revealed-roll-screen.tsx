import { useIsFocused, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { ContestCard } from "@/features/contest/contest-card";
import { GalleryScreen } from "@/features/gallery/gallery-screen";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { colors, spacing } from "@/ui/theme";
import { RollOverview } from "./roll-overview";

/**
 * The roll screen (`/roll/[tripId]`) once the roll is revealed: "Galería | Rollo", like the Mapa tab's "Mapa | Feed".
 * The view lives in the `view` route param ("gallery" by default, or "roll"). The gallery is always
 * mounted (Rollo is drawn over it), so going back keeps its scroll; its toolbar only shows in Galería.
 *
 * The "Galería | Rollo" control is the navigation bar's title view (see `RollViewSwitch`, set by `RollScreen`);
 * each view starts with the roll's name as a large title.
 */
export function RevealedRollScreen({
  tripId,
  onSelectionChange,
  onShare,
}: {
  tripId: string;
  /** "Compartir" for the gallery's toolbar (the "Rollo" view gets it from the roll screen's own toolbar). */
  onShare?: () => void;
  /** Passed on from the gallery: how many photos are selected, or null when it isn't selecting. */
  onSelectionChange?: (count: number | null) => void;
}) {
  // The two views stay mounted: the contest card only opens the winner reveal while this screen is the one in view.
  const focused = useIsFocused();
  const { detail } = useTripDetail(tripId);
  const contestEnabled = !!detail?.trip.contest?.enabled;
  const { view } = useLocalSearchParams<{ view?: string }>();
  const showRoll = view === "roll";
  const background = showRoll ? colors.groupedBackground : colors.background;

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <View style={styles.body}>
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={showRoll ? "none" : "auto"}
          accessibilityElementsHidden={showRoll}
          importantForAccessibility={showRoll ? "no-hide-descendants" : "auto"}
        >
          <GalleryScreen
            tripId={tripId}
            toolbar={!showRoll}
            onSelectionChange={onSelectionChange}
            onShare={onShare}
            header={<ContestCard tripId={tripId} enabled={contestEnabled} focused={focused} style={{ margin: spacing.md }} />}
          />
        </View>
        {showRoll && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.groupedBackground }]}>
            <RollOverview tripId={tripId} focused={focused} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
});

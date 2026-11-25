import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, useColorScheme, View } from "react-native";
import { ContestCard } from "@/features/contest/contest-card";
import { GalleryScreen } from "@/features/gallery/gallery-screen";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { colors, layout, spacing, tintHex } from "@/ui/theme";
import { RollOverview } from "./roll-overview";

const VIEWS = ["Galería", "Rollo"];

/**
 * The roll screen (`/roll/[tripId]`) once the roll is revealed: "Galería | Rollo", like the Mapa tab's "Mapa | Feed".
 * The view lives in the `view` route param ("gallery" by default, or "roll"). The gallery is always
 * mounted (Rollo is drawn over it), so going back keeps its scroll; its toolbar only shows in Galería.
 *
 * The screen's header is solid here (set by the route) with the same background as the row, so the row
 * just goes first in the flow and the views start below it.
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
  const router = useRouter();
  // The two views stay mounted: the contest card only opens the winner reveal while this screen is the one in view.
  const focused = useIsFocused();
  const { detail } = useTripDetail(tripId);
  const contestEnabled = !!detail?.trip.contest?.enabled;
  const { view } = useLocalSearchParams<{ view?: string }>();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const showRoll = view === "roll";
  const background = showRoll ? colors.groupedBackground : colors.background;

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <View testID="revealed-roll-controls" style={[styles.controls, { backgroundColor: background }]}>
        <View style={styles.row}>
          <SegmentedControl
            values={VIEWS}
            tintColor={tintHex[scheme]}
            selectedIndex={showRoll ? 1 : 0}
            onValueChange={(v) => router.setParams({ view: v === "Rollo" ? "roll" : "gallery" })}
          />
        </View>
      </View>
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
  controls: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  body: { flex: 1 },
  row: { height: layout.controlsRowHeight, justifyContent: "center" },
});

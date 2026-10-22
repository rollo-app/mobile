import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, useColorScheme, View } from "react-native";
import { GalleryScreen } from "@/features/gallery/gallery-screen";
import { colors, layout, spacing, tintHex } from "@/ui/theme";
import { RollOverview } from "./roll-overview";

const VIEWS = ["Galería", "Rollo"];

/**
 * The Rollo tab once the roll is revealed: "Galería | Rollo", like the Mapa tab's "Mapa | Feed".
 * The view lives in the `view` route param ("gallery" by default, or "roll"). The gallery is always
 * mounted (Rollo is drawn over it), so going back keeps its scroll; its toolbar only shows in Galería.
 *
 * The tab's header is solid here (set by the route) with the same background as the row, so the row
 * just goes first in the flow and the views start below it.
 */
export function RevealedRollScreen({ tripId }: { tripId: string }) {
  const router = useRouter();
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
          <GalleryScreen tripId={tripId} toolbar={!showRoll} />
        </View>
        {showRoll && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.groupedBackground }]}>
            <RollOverview tripId={tripId} />
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

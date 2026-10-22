import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GalleryScreen } from "@/features/gallery/gallery-screen";
import { colors, layout, spacing, tintHex } from "@/ui/theme";
import { RollOverview } from "./roll-overview";

const VIEWS = ["Galería", "Rollo"];
/** What the row takes from the top of the content, which the scrolling views leave free. */
const ROW_INSET = layout.controlsRowHeight + 2 * spacing.sm;

/**
 * The Rollo tab once the roll is revealed: "Galería | Rollo", like the Mapa tab's "Mapa | Feed".
 * The view lives in the `view` route param ("gallery" by default, or "roll"). The gallery is always
 * mounted (Rollo is drawn over it), so going back keeps its scroll; its toolbar only shows in Galería.
 *
 * The header is translucent and the views go under it, so the row is drawn over them right below the
 * header (`insets.top + layout.headerHeight`, like the map's), with an opaque background so the photos
 * scrolling under it don't show through; the views leave `ROW_INSET` free at their top.
 */
export function RevealedRollScreen({ tripId }: { tripId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const showRoll = view === "roll";
  const background = showRoll ? colors.groupedBackground : colors.background;

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={showRoll ? "none" : "auto"}
        accessibilityElementsHidden={showRoll}
        importantForAccessibility={showRoll ? "no-hide-descendants" : "auto"}
      >
        <GalleryScreen tripId={tripId} toolbar={!showRoll} contentInsetTop={ROW_INSET} />
      </View>
      {showRoll && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.groupedBackground }]}>
          <RollOverview tripId={tripId} contentInsetTop={ROW_INSET} />
        </View>
      )}
      <View
        testID="revealed-roll-controls"
        style={[styles.controls, { top: insets.top + layout.headerHeight, backgroundColor: background }]}
      >
        <View style={styles.row}>
          <SegmentedControl
            values={VIEWS}
            tintColor={tintHex[scheme]}
            selectedIndex={showRoll ? 1 : 0}
            onValueChange={(v) => router.setParams({ view: v === "Rollo" ? "roll" : "gallery" })}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  controls: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  row: { height: layout.controlsRowHeight, justifyContent: "center" },
});

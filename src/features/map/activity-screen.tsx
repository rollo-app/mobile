import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { FeedList } from "@/features/feed/feed-list";
import type { MapItem } from "@/features/map/features";
import { CONTROLS_ROW_HEIGHT, RollMap } from "@/features/map/roll-map";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { spacing, tintHex } from "@/ui/theme";

const VIEWS = ["Mapa", "Feed"];

/**
 * The Mapa tab: the roll's map and, before the reveal, its Feed, switched with "Mapa | Feed".
 * The view lives in the `view` route param ("map" by default, or "feed"). The map is always
 * mounted: the Feed is drawn over it, so going back keeps the camera and the loaded style.
 */
export function ActivityScreen() {
  const router = useRouter();
  const { view, focus } = useLocalSearchParams<{ view?: string; focus?: string }>();
  const { trip } = useActiveTrip();
  const { detail } = useTripDetail(trip?.id);
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  // After the reveal there is no Feed: the photos are in the gallery and the view is always Mapa.
  const revealed = detail?.trip.revealed ?? false;
  const showFeed = !revealed && view === "feed";

  const openOnMap = useCallback((item: MapItem) => router.setParams({ view: "map", focus: item.id }), [router]);

  const segmented = revealed ? undefined : (
    <SegmentedControl
      style={styles.segmented}
      values={VIEWS}
      tintColor={tintHex[scheme]}
      selectedIndex={showFeed ? 1 : 0}
      onValueChange={(v) => router.setParams({ view: v === "Feed" ? "feed" : "map" })}
    />
  );

  return (
    <RollMap
      focus={focus}
      rowStart={segmented}
      cover={showFeed ? <FeedList onOpenOnMap={openOnMap} contentInsetTop={CONTROLS_ROW_HEIGHT + 2 * spacing.sm} /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  segmented: { flex: 1 },
});

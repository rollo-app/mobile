import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { FeedList } from "@/features/feed/feed-list";
import type { MapItem } from "@/features/map/features";
import { CONTROLS_ROW_HEIGHT, RollMap } from "@/features/map/roll-map";
import { isEvent } from "@/features/events/event";
import { TripSwitcher } from "@/features/trips/trip-switcher";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { spacing, tintHex } from "@/ui/theme";

const VIEWS = ["Mapa", "Feed"];

/**
 * The Mapa tab: the roll's map and, before the reveal, its Feed, switched with "Mapa | Feed".
 * In an event it is only the Feed (no map, no switch) and, once revealed, it sends you to Rollo.
 * The view lives in the `view` route param ("map" by default, or "feed"). The map is always
 * mounted: the Feed is drawn over it, so going back keeps the camera and the loaded style.
 */
export function ActivityScreen() {
  const router = useRouter();
  const { view, focus } = useLocalSearchParams<{ view?: string; focus?: string }>();
  const { trip } = useActiveTrip();
  const { detail } = useTripDetail(trip?.id);
  const eventTrip = trip ? isEvent(trip) : false;
  const revealed = detail?.trip.revealed ?? false;
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const openOnMap = useCallback((item: MapItem) => router.setParams({ view: "map", focus: item.id }), [router]);

  // An event has no map and its tab is hidden once revealed: if the reveal lands while this tab is focused, go to Rollo.
  const leaveRevealedEvent = eventTrip && revealed;
  useEffect(() => {
    if (leaveRevealedEvent) router.navigate("/roll");
  }, [leaveRevealedEvent, router]);

  if (eventTrip) {
    if (leaveRevealedEvent) return null;
    return (
      <>
        <Stack.Screen options={{ title: "Feed", headerTitle: () => (trip ? <TripSwitcher name={trip.name} /> : null) }} />
        <FeedList />
      </>
    );
  }

  // After the reveal there is no Feed: the photos are in the gallery and the view is always Mapa.
  const showFeed = !revealed && view === "feed";

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

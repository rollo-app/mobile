import { MenuView } from "@expo/ui/community/menu";
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { Camera, Images, Map, UserLocation, type CameraRef, type GeoJSONSourceRef } from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePendingItems } from "@/features/capture/use-pending-items";
import { boundsOf, feedToItems, itemsByTime, mergeItems, pendingToItems, toFeatures, type MapItem } from "@/features/map/features";
import { fitTarget, isTripActive, MAX_ZOOM, photosNear } from "@/features/map/framing";
import { silenceTileNetworkErrors } from "@/features/map/log-filter";
import { CAROUSEL_HEIGHT, PinCarousel } from "@/features/map/pin-carousel";
import { UserLocationDot } from "@/features/map/user-location-dot";
import { usePinAvatars } from "@/features/map/use-pin-avatars";
import { PinLayers } from "@/features/map/pin-layers";
import { writeStyleFile } from "@/features/map/style-file";
import { resolveTap } from "@/features/map/tap";
import { NoRollYet } from "@/features/roll/no-roll-yet";
import { hasNoTrips } from "@/features/trips/active";
import { rollPhase } from "@/features/trips/phase";
import { TripSwitcher } from "@/features/trips/trip-switcher";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useRevealedPhotos } from "@/features/media/revealed";
import { useFeed } from "@/features/trips/use-feed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { colors, radius, spacing, tintHex, type } from "@/ui/theme";

silenceTileNetworkErrors();

// No pins or location: southern Argentina, where the trip is.
const DEFAULT_REGION = { center: [-72.89, -49.33] as [number, number], zoom: 6 };
const HEADER_HEIGHT = 44;
const TAB_BAR_GAP = 12;
// Height of the native tab bar (49 pt + 34 pt home indicator on notch iPhones). If the
// safe area already includes it, `Math.max` changes nothing; if not, this keeps it from covering what's below.
const TAB_BAR_MIN_INSET = 83;
const USER_ZOOM = 12;
const FOCUS_ZOOM = 15;
const BUTTON_SIZE = 40;
// Gap between the bar and the carousel.
const CAROUSEL_BOTTOM = 18;
const NO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };

type PressEvent = { nativeEvent: { features: GeoJSON.Feature[] }; stopPropagation?: () => void };

export default function MapScreen() {
  const { trip, loaded } = useActiveTrip();
  if (hasNoTrips(loaded, trip)) return <NoRollYet />;
  return <MapBody />;
}

function MapBody() {
  const { trip } = useActiveTrip();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { detail } = useTripDetail(trip?.id);
  const { feed, error, refetch } = useFeed(trip?.id);
  const pending = usePendingItems(trip?.id);
  const { token } = useRevealedPhotos(trip?.id);
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  const [pickedScope, setScope] = useState<"all" | "today">("all");
  // Once the roll has ended there is no "today" anymore: only "Todo" applies.
  const phase = detail ? rollPhase(detail.trip, Date.now()) : null;
  const hasToday = phase !== "ended" && phase !== "revealed";
  const scope = hasToday ? pickedScope : "all";
  const [authorId, setAuthorId] = useState<string | null>(null);
  // Photos at the tapped place or cluster and which of them is showing in the carousel.
  // `clusterId` keeps the tapped cluster highlighted while its photos are swiped.
  const [selection, setSelection] = useState<{ ids: string[]; index: number; clusterId: number | null } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [hasLocation, setHasLocation] = useState<boolean | null>(null);

  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const framed = useRef(false);
  const zoomRef = useRef(DEFAULT_REGION.zoom);
  // Where the camera was centered with padding for the carousel; null when there is none.
  const padded = useRef<[number, number] | null>(null);

  const styleUri = useMemo(() => writeStyleFile(scheme), [scheme]);

  const items = useMemo<MapItem[]>(() => {
    const mine = detail?.me ? pendingToItems(pending, detail.me) : [];
    return mergeItems(feed ? feedToItems(feed.items) : [], mine);
  }, [feed, pending, detail?.me]);

  const all = useMemo(() => toFeatures(items, { day: null, authorId: null }), [items]);
  const pinAvatars = usePinAvatars(items);
  const shown = useMemo(
    () => toFeatures(items, { day: scope === "today" ? (detail?.today.date ?? null) : null, authorId }, pinAvatars.ready),
    [items, scope, authorId, detail?.today.date, pinAvatars.ready],
  );
  const carousel = useMemo(
    () => (selection ? itemsByTime(items, selection.ids) : []),
    [items, selection],
  );
  const selectedId = selection ? (carousel[selection.index]?.id ?? null) : null;
  const noPins = shown.features.length === 0;

  // If the tapped thing falls outside the filters, the card goes away with the pin.
  useEffect(() => {
    if (selection && !selection.ids.some((id) => shown.features.some((f) => f.properties.id === id))) setSelection(null);
  }, [shown, selection]);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then((p) => setHasLocation(p.granted), () => setHasLocation(false));
  }, []);

  const barInset = Math.max(insets.bottom, TAB_BAR_MIN_INSET) + TAB_BAR_GAP;
  const carouselInset = barInset + CAROUSEL_BOTTOM + CAROUSEL_HEIGHT;
  const buttonsTop = insets.top + HEADER_HEIGHT + 64 + spacing.sm;

  const padding = useMemo(
    () => ({ top: insets.top + HEADER_HEIGHT + 64, right: 48, bottom: Math.max(insets.bottom, TAB_BAR_MIN_INSET) + 160, left: 48 }),
    [insets.top, insets.bottom],
  );

  function frameAll(features: typeof all.features, duration: number) {
    const bounds = boundsOf(features);
    if (!bounds) return;
    const target = fitTarget(bounds);
    if (target.kind === "center") cameraRef.current?.easeTo({ center: target.center, zoom: target.zoom, duration });
    else cameraRef.current?.fitBounds(target.bounds, { padding, duration });
  }

  // On enter: with the trip in progress and location permission, where you are; otherwise, all pins in
  // view; with no pins, the trip's default region. Waits to know the permission and to have data.
  const tripKnown = !!detail || !!error;
  useEffect(() => {
    if (!mapReady || framed.current || hasLocation === null || !tripKnown || !(feed || error)) return;
    framed.current = true;
    const active = detail ? isTripActive(detail.trip, Date.now()) : false;
    (async () => {
      if (active && hasLocation && (await centerOnUser(false))) return;
      frameAll(all.features, 0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, hasLocation, tripKnown, all, feed, error, detail, padding]);

  // Arrived from the Feed with a photo: no filters, fly to it (zoom 15) and open its card. The
  // param is consumed so tapping the same photo again after moving the map works.
  useEffect(() => {
    if (!focus || !mapReady) return;
    const target = items.find((i) => i.id === focus);
    if (!target) return;
    router.setParams({ focus: undefined });
    if (target.lat === null || target.lng === null) return;
    framed.current = true;
    setScope("all");
    setAuthorId(null);
    cameraRef.current?.flyTo({ center: [target.lng, target.lat], zoom: FOCUS_ZOOM, duration: 600 });
    const ids = itemsByTime(items, photosNear(all.features, [target.lng, target.lat], FOCUS_ZOOM).map((f) => f.properties.id)).map((i) => i.id);
    setSelection({ ids, index: Math.max(0, ids.indexOf(focus)), clusterId: null });
  }, [focus, mapReady, items, all, router]);

  async function centerOnUser(ask: boolean): Promise<boolean> {
    try {
      const permission = ask
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      setHasLocation(permission.granted);
      if (!permission.granted) return false;
      const position =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (!position) return false;
      cameraRef.current?.flyTo({
        center: [position.coords.longitude, position.coords.latitude],
        zoom: USER_ZOOM,
        duration: ask ? 600 : 0,
      });
      return true;
    } catch {
      return false; // With no location the map stays where it is.
    }
  }

  const onPinsPress = useCallback(
    (event: PressEvent) => {
      const feature = event.nativeEvent.features[0];
      if (!feature) return;
      event.stopPropagation?.();
      const center = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      void (async () => {
        const tap = await resolveTap(feature, {
          features: shown.features,
          zoom: zoomRef.current,
          getLeaves: async (id, limit, offset) => (await sourceRef.current?.getClusterLeaves(id, limit, offset)) ?? [],
        });
        setSelection({ ids: tap.ids, index: 0, clusterId: tap.clusterId });
        // A cluster only gets centered (same zoom), with room below so the carousel doesn't cover it.
        if (tap.clusterId !== null) {
          cameraRef.current?.easeTo({ center, padding: { ...NO_PADDING, bottom: carouselInset }, duration: 400 });
          padded.current = center;
        }
      })();
    },
    [shown.features, carouselInset],
  );

  // When the carousel closes (or a single pin takes over), the padding that made room for it goes away.
  const clusterId = selection?.clusterId ?? null;
  useEffect(() => {
    if (clusterId === null && padded.current) {
      cameraRef.current?.easeTo({ center: padded.current, padding: NO_PADDING, duration: 300 });
      padded.current = null;
    }
  }, [clusterId]);

  const members = detail?.members ?? [];
  const authorName = members.find((m) => m.id === authorId)?.name;
  const actions = [
    { id: "all", title: "Todos", state: authorId === null ? ("on" as const) : ("off" as const) },
    ...members.map((m) => ({ id: m.id, title: m.name, state: authorId === m.id ? ("on" as const) : ("off" as const) })),
  ];

  return (
    <View style={styles.fill}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerShadowVisible: false,
          ...(trip ? { headerTitle: () => <TripSwitcher name={trip.name} /> } : {}),
        }}
      />
      <Map
        key={styleUri}
        style={styles.fill}
        mapStyle={styleUri}
        logo={false}
        compass
        compassPosition={{ top: buttonsTop + BUTTON_SIZE + spacing.sm, right: spacing.md }}
        attribution={false}
        onDidFinishLoadingMap={() => setMapReady(true)}
        onRegionDidChange={(e) => {
          zoomRef.current = e.nativeEvent.zoom;
        }}
        onPress={() => setSelection(null)}
      >
        <Camera ref={cameraRef} initialViewState={DEFAULT_REGION} maxZoom={MAX_ZOOM} />
        {hasLocation === true && (
          <UserLocation>
            <UserLocationDot color={tintHex[scheme]} />
          </UserLocation>
        )}
        {/* Before the pins: its images are registered before the data that references them. */}
        <Images images={pinAvatars.images} />
        <PinLayers data={shown} selectedId={selectedId} selectedClusterId={selection?.clusterId ?? null} haloColor={tintHex[scheme]} sourceRef={sourceRef} onPress={onPinsPress} />
      </Map>

      <View pointerEvents="box-none" style={[styles.controls, { top: insets.top + HEADER_HEIGHT + spacing.sm }]}>
        <View style={styles.row}>
          {hasToday ? (
            <SegmentedControl
              style={styles.segmented}
              values={["Todo", "Hoy"]}
              tintColor={tintHex[scheme]}
              selectedIndex={scope === "all" ? 0 : 1}
              onValueChange={(v) => setScope(v === "Hoy" ? "today" : "all")}
            />
          ) : (
            <View style={styles.segmented} />
          )}
          <MenuView
            title="Personas"
            actions={actions}
            onPressAction={({ nativeEvent }) => setAuthorId(nativeEvent.event === "all" ? null : nativeEvent.event)}
          >
            <View style={styles.pill}>
              <SymbolView name="person.2" size={15} tintColor={(authorId ? colors.tint : colors.label) as string} />
              <Text style={[type.subhead, { color: authorId ? colors.tint : colors.label }]} numberOfLines={1}>
                {authorName ?? "Personas"}
              </Text>
            </View>
          </MenuView>
        </View>
        {error && (
          <View style={styles.notice}>
            <Text numberOfLines={1} style={[type.footnote, styles.noticeText]}>
              {error}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Reintentar" onPress={() => void refetch()}>
              <Text style={[type.footnote, { color: colors.tint, fontWeight: "600" }]}>Reintentar</Text>
            </Pressable>
          </View>
        )}
        {noPins && !error && (
          <View style={styles.notice}>
            <Text style={[type.footnote, styles.noticeText]}>Todavía no hay fotos en el mapa</Text>
          </View>
        )}
      </View>

      <View style={[styles.buttons, { top: buttonsTop }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver todas"
          onPress={() => frameAll(shown.features, 500)}
          style={styles.round}
        >
          <SymbolView name="square.dashed" size={17} tintColor={colors.label as string} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Centrar en mi ubicación"
          onPress={() => void centerOnUser(true)}
          style={styles.round}
        >
          <SymbolView name="location.fill" size={17} tintColor={colors.label as string} />
        </Pressable>
      </View>

      {/* ODbL requires showing the attribution while the map is visible: fixed text, not tappable. */}
      <Text pointerEvents="none" style={[type.caption, styles.attribution, { bottom: barInset + 2 }]}>
        © OpenStreetMap · OpenFreeMap
      </Text>

      {carousel.length > 0 && detail && selection && (
        <View pointerEvents="box-none" style={[styles.cardWrap, { bottom: barInset + CAROUSEL_BOTTOM }]}>
          <PinCarousel
            key={selection.ids.join()}
            items={carousel}
            index={selection.index}
            onIndexChange={(index) => setSelection({ ...selection, index })}
            timeZone={detail.trip.timezone}
            token={token}
            onOpen={detail.trip.revealed ? (item) => router.push(`/photo/${item.id}`) : undefined}
          />
        </View>
      )}
    </View>
  );
}

const chip = {
  backgroundColor: colors.background,
  borderRadius: radius.full,
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
} as const;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  controls: { position: "absolute", left: spacing.md, right: spacing.md, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  segmented: { flex: 1 },
  pill: { ...chip, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, height: 34 },
  notice: {
    ...chip,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noticeText: { color: colors.secondaryLabel },
  buttons: { position: "absolute", right: spacing.md, flexDirection: "row", gap: spacing.sm },
  round: { ...chip, width: BUTTON_SIZE, height: BUTTON_SIZE, alignItems: "center", justifyContent: "center" },
  attribution: { position: "absolute", left: spacing.md, color: colors.secondaryLabel },
  cardWrap: { position: "absolute", left: 0, right: 0 },
});

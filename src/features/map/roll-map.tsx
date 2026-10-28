import { MenuView } from "@expo/ui/community/menu";
import { Camera, Images, Map, UserLocation, type CameraRef, type GeoJSONSourceRef } from "@maplibre/maplibre-react-native";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePendingItems } from "@/features/capture/use-pending-items";
import { boundsOf, feedToItems, itemsByTime, mergeItems, pendingToItems, toFeatures, type MapItem } from "@/features/map/features";
import { buildFilterActions } from "@/features/map/filter-menu";
import { fitTarget, MAX_ZOOM, photosNear } from "@/features/map/framing";
import { filterActive, filterLabel } from "@/features/map/map-filters";
import { silenceTileNetworkErrors } from "@/features/map/log-filter";
import { CAROUSEL_HEIGHT, PinCarousel } from "@/features/map/pin-carousel";
import { UserLocationDot } from "@/features/map/user-location-dot";
import { useMapFilters } from "@/features/map/use-map-filters";
import { useMapStart } from "@/features/map/use-map-start";
import { usePinAvatars } from "@/features/map/use-pin-avatars";
import { useUserLocation } from "@/features/map/use-user-location";
import { PinLayers } from "@/features/map/pin-layers";
import { writeStyleFile } from "@/features/map/style-file";
import { resolveTap } from "@/features/map/tap";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { rollPhase } from "@/features/trips/phase";
import { TripSwitcher } from "@/features/trips/trip-switcher";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useRevealedPhotos } from "@/features/media/revealed";
import { useFeed } from "@/features/trips/use-feed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { colors, layout, radius, spacing, tintHex, type } from "@/ui/theme";

silenceTileNetworkErrors();

const HEADER_HEIGHT = layout.headerHeight;
/** Height of the row under the header (segmented control and filter pill). */
export const CONTROLS_ROW_HEIGHT = layout.controlsRowHeight;
const TAB_BAR_GAP = 12;
// Height of the native tab bar (49 pt + 34 pt home indicator on notch iPhones). If the
// safe area already includes it, `Math.max` changes nothing; if not, this keeps it from covering what's below.
const TAB_BAR_MIN_INSET = 83;
const FOCUS_ZOOM = 15;
const BUTTON_SIZE = 40;
// Gap between the bar and the carousel.
const CAROUSEL_BOTTOM = 18;
const NO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };

type PressEvent = { nativeEvent: { features: GeoJSON.Feature[] }; stopPropagation?: () => void };

type RollMapProps = {
  /** Photo to fly to and open (from the Feed); it is consumed by clearing the `focus` route param. */
  focus?: string;
  /** Drawn at the start of the row under the header, before the filter pill. */
  rowStart?: ReactNode;
  /**
   * Drawn over the map (opaque, under the row) while the map stays mounted, so the camera and the
   * style survive. While it is there the map's own controls are hidden and only `rowStart` stays.
   */
  cover?: ReactNode;
};

export function RollMap({ focus, rowStart, cover }: RollMapProps = {}) {
  const { trip } = useActiveTrip();
  const router = useRouter();
  const { detail } = useTripDetail(trip?.id);
  const { feed, error, refetch } = useFeed(trip?.id);
  const pending = usePendingItems(trip?.id);
  const { token } = useRevealedPhotos(trip?.id);
  const openProfile = useOpenProfile();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  const { filters: picked, onAction: onFilterAction, clear: clearFilters } = useMapFilters();
  // Once the roll has ended there is no "today" anymore: "Solo hoy" goes away.
  const phase = detail ? rollPhase(detail.trip, Date.now()) : null;
  const hasToday = phase !== "ended" && phase !== "revealed";
  const today = hasToday && picked.today;
  const { authorId, moments: momentsOnly } = picked;
  // Photos at the tapped place or cluster and which of them is showing in the carousel.
  // `clusterId` keeps the tapped cluster highlighted while its photos are swiped.
  const [selection, setSelection] = useState<{ ids: string[]; index: number; clusterId: number | null } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
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
    () => toFeatures(items, { day: today ? (detail?.today.date ?? null) : null, authorId, momentsOnly }, pinAvatars.ready),
    [items, today, authorId, momentsOnly, detail?.today.date, pinAvatars.ready],
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

  const { hasLocation, centerOnUser } = useUserLocation(cameraRef);

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

  const { start, framed, zoomRef } = useMapStart({
    detail,
    error,
    hasFeed: !!feed,
    all,
    padding,
    hasLocation,
    mapReady,
    centerOnUser,
    frameAll,
  });

  // Arrived from the Feed with a photo: no filters, fly to it (zoom 15) and open its card. The
  // param is consumed so tapping the same photo again after moving the map works.
  useEffect(() => {
    if (!focus || !mapReady) return;
    const target = items.find((i) => i.id === focus);
    if (!target) return;
    router.setParams({ focus: undefined });
    if (target.lat === null || target.lng === null) return;
    framed.current = true;
    clearFilters();
    cameraRef.current?.flyTo({ center: [target.lng, target.lat], zoom: FOCUS_ZOOM, duration: 600 });
    const ids = itemsByTime(items, photosNear(all.features, [target.lng, target.lat], FOCUS_ZOOM).map((f) => f.properties.id)).map((i) => i.id);
    setSelection({ ids, index: Math.max(0, ids.indexOf(focus)), clusterId: null });
  }, [focus, mapReady, items, all, router]);

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
  // Offered once the roll has any moment: before that the filter would only show an empty map.
  const hasMoments = momentsOnly || items.some((i) => !!i.momentDay);
  const filters = { today, moments: momentsOnly, authorName: members.find((m) => m.id === authorId)?.name ?? null };
  const filterColor = filterActive(filters) ? colors.tint : colors.label;
  const actions = buildFilterActions({ hasToday, hasMoments, today, momentsOnly, authorId, members });

  return (
    <View style={styles.fill}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerShadowVisible: false,
          ...(trip ? { headerTitle: () => <TripSwitcher name={trip.name} /> } : {}),
        }}
      />
      {/* While covered, VoiceOver skips the map: it is not what is on screen. */}
      <View
        style={[styles.fill, styles.mapBackground]}
        accessibilityElementsHidden={!!cover}
        importantForAccessibility={cover ? "no-hide-descendants" : "auto"}
      >
        {start && (
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
            <Camera ref={cameraRef} initialViewState={start} maxZoom={MAX_ZOOM} />
            {hasLocation === true && (
              <UserLocation>
                <UserLocationDot color={tintHex[scheme]} />
              </UserLocation>
            )}
            {/* Before the pins: its images are registered before the data that references them. */}
            <Images images={pinAvatars.images} />
            <PinLayers data={shown} selectedId={selectedId} selectedClusterId={selection?.clusterId ?? null} haloColor={tintHex[scheme]} sourceRef={sourceRef} onPress={onPinsPress} />
          </Map>
        )}
      </View>

      {cover && <View style={[StyleSheet.absoluteFill, styles.cover]}>{cover}</View>}

      <View pointerEvents="box-none" style={[styles.controls, { top: insets.top + HEADER_HEIGHT + spacing.sm }]}>
        <View style={styles.row}>
          {rowStart ?? <View style={styles.rowStart} />}
          {!cover && (
            <MenuView title="Filtros" actions={actions} onPressAction={({ nativeEvent }) => onFilterAction(nativeEvent.event)}>
              <View style={styles.pill}>
                <SymbolView name="line.3.horizontal.decrease.circle" size={15} tintColor={filterColor as string} />
                <Text style={[type.subhead, { color: filterColor }]} numberOfLines={1}>
                  {filterLabel(filters)}
                </Text>
              </View>
            </MenuView>
          )}
        </View>
        {!cover && error && (
          <View style={styles.notice}>
            <Text numberOfLines={1} style={[type.footnote, styles.noticeText]}>
              {error}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Reintentar" onPress={() => void refetch()}>
              <Text style={[type.footnote, { color: colors.tint, fontWeight: "600" }]}>Reintentar</Text>
            </Pressable>
          </View>
        )}
        {!cover && noPins && !error && (
          <View style={styles.notice}>
            <Text style={[type.footnote, styles.noticeText]}>Todavía no hay fotos en el mapa</Text>
          </View>
        )}
      </View>

      {!cover && (
        <>
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
                // After the reveal every photo opens; before it only the daily moments (the only ones with files).
                canOpen={(item) => detail.trip.revealed || (!!item.momentDay && !!item.thumbPath)}
                onOpen={(item) => router.push({ pathname: "/photo/[id]", params: { id: item.id, tripId: detail.trip.id } })}
                onOpenAuthor={(item) => item.authorUserId && openProfile(item.authorUserId)}
              />
            </View>
          )}
        </>
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
  rowStart: { flex: 1 },
  pill: { ...chip, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, height: CONTROLS_ROW_HEIGHT },
  cover: { backgroundColor: colors.background },
  mapBackground: { backgroundColor: colors.background },
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

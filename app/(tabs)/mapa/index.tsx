import { MenuView } from "@expo/ui/community/menu";
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { Camera, Map, UserLocation, type CameraRef, type GeoJSONSourceRef } from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePendingItems } from "@/features/capture/use-pending-items";
import { boundsOf, feedToItems, itemsByTime, mergeItems, toFeatures, type MapItem } from "@/features/map/features";
import { fitTarget, isTripActive, photosNear } from "@/features/map/framing";
import { silenceTileNetworkErrors } from "@/features/map/log-filter";
import { PinCarousel } from "@/features/map/pin-carousel";
import { CLUSTER_MAX_ZOOM, PinLayers } from "@/features/map/pin-layers";
import { writeStyleFile } from "@/features/map/style-file";
import { TripSwitcher } from "@/features/trips/trip-switcher";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useFeed } from "@/features/trips/use-feed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { colors, radius, spacing, type } from "@/ui/theme";

silenceTileNetworkErrors();

// Sin pins ni ubicación: el sur de Argentina, donde es el viaje.
const DEFAULT_REGION = { center: [-72.89, -49.33] as [number, number], zoom: 6 };
const HEADER_HEIGHT = 44;
const TAB_BAR_GAP = 12;
// Altura de la barra de tabs nativa (49 pt + indicador de inicio de 34 pt en iPhones con notch). Si el
// safe area ya la incluye, `Math.max` no cambia nada; si no, esto garantiza que no tape lo de abajo.
const TAB_BAR_MIN_INSET = 83;
const USER_ZOOM = 12;

type PressEvent = { nativeEvent: { features: GeoJSON.Feature[] }; stopPropagation?: () => void };

export default function MapScreen() {
  const { trip } = useActiveTrip();
  const { detail } = useTripDetail(trip?.tripId);
  const { feed, error, refetch } = useFeed(trip?.tripId);
  const pending = usePendingItems(trip?.tripId);
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  const [scope, setScope] = useState<"all" | "today">("all");
  const [authorId, setAuthorId] = useState<string | null>(null);
  // Las fotos del lugar tocado (ordenadas por hora) y cuál de ellas está a la vista en el carrusel.
  const [selection, setSelection] = useState<{ ids: string[]; index: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [hasLocation, setHasLocation] = useState<boolean | null>(null);

  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const framed = useRef(false);
  const zoomRef = useRef(DEFAULT_REGION.zoom);

  const styleUri = useMemo(() => writeStyleFile(scheme), [scheme]);

  const items = useMemo<MapItem[]>(() => {
    const me = detail?.me;
    const mine: MapItem[] = me
      ? pending.map((m) => ({
          id: m.id,
          type: m.type,
          takenAt: m.takenAt,
          day: m.day,
          lat: m.lat,
          lng: m.lng,
          caption: m.caption,
          durationS: m.durationS,
          thumbhash: m.thumbhash,
          authorId: me.id,
          authorName: me.name,
          pending: true,
        }))
      : [];
    return mergeItems(feed ? feedToItems(feed.items) : [], mine);
  }, [feed, pending, detail?.me]);

  const all = useMemo(() => toFeatures(items, { day: null, authorId: null }), [items]);
  const shown = useMemo(
    () => toFeatures(items, { day: scope === "today" ? (detail?.today.date ?? null) : null, authorId }),
    [items, scope, authorId, detail?.today.date],
  );
  const carousel = useMemo(
    () => (selection ? itemsByTime(items, selection.ids) : []),
    [items, selection],
  );
  const selectedId = selection ? (carousel[selection.index]?.id ?? null) : null;
  const noPins = shown.features.length === 0;

  // Si lo tocado queda afuera de los filtros, la tarjeta se va con el pin.
  useEffect(() => {
    if (selection && !selection.ids.some((id) => shown.features.some((f) => f.properties.id === id))) setSelection(null);
  }, [shown, selection]);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then((p) => setHasLocation(p.granted), () => setHasLocation(false));
  }, []);

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

  // Al entrar: con el viaje en curso y permiso de ubicación, donde estás; si no, todos los pins a la
  // vista; sin pins, la región del viaje por defecto. Espera a saber el permiso y a tener datos.
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
      return false; // Sin ubicación el mapa queda donde está.
    }
  }

  const onPinsPress = useCallback(
    (event: PressEvent) => {
      const feature = event.nativeEvent.features[0];
      if (!feature) return;
      event.stopPropagation?.();
      const props = feature.properties ?? {};
      const center = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      const select = (ids: string[]) => setSelection({ ids, index: 0 });

      if (!props.cluster) {
        select(photosNear(shown.features, center, zoomRef.current).map((f) => f.properties.id));
        return;
      }
      void (async () => {
        const source = sourceRef.current;
        const expansion = await source?.getClusterExpansionZoom(props.cluster_id);
        // Un cluster que ya no se puede abrir (fotos en el mismo punto): sus hojas pasan al carrusel.
        if (expansion === undefined || expansion > CLUSTER_MAX_ZOOM || zoomRef.current >= CLUSTER_MAX_ZOOM) {
          const leaves = (await source?.getClusterLeaves(props.cluster_id, props.point_count ?? 100, 0)) ?? [];
          select(leaves.map((l) => l.properties?.id).filter((id): id is string => typeof id === "string"));
        } else {
          cameraRef.current?.easeTo({ center, zoom: expansion, duration: 400 });
        }
      })();
    },
    [shown.features],
  );

  const barInset = Math.max(insets.bottom, TAB_BAR_MIN_INSET) + TAB_BAR_GAP;
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
          ...(trip ? { headerTitle: () => <TripSwitcher name={trip.tripName} /> } : {}),
        }}
      />
      <Map
        key={styleUri}
        style={styles.fill}
        mapStyle={styleUri}
        logo={false}
        compass={false}
        attribution={false}
        onDidFinishLoadingMap={() => setMapReady(true)}
        onRegionDidChange={(e) => {
          zoomRef.current = e.nativeEvent.zoom;
        }}
        onPress={() => setSelection(null)}
      >
        <Camera ref={cameraRef} initialViewState={DEFAULT_REGION} />
        {hasLocation === true && <UserLocation />}
        <PinLayers data={shown} selectedId={selectedId} sourceRef={sourceRef} onPress={onPinsPress} />
      </Map>

      <View pointerEvents="box-none" style={[styles.controls, { top: insets.top + HEADER_HEIGHT + spacing.sm }]}>
        <View style={styles.row}>
          <SegmentedControl
            style={styles.segmented}
            values={["Todo", "Hoy"]}
            selectedIndex={scope === "all" ? 0 : 1}
            onValueChange={(v) => setScope(v === "Hoy" ? "today" : "all")}
          />
          <MenuView
            title="Personas"
            actions={actions}
            onPressAction={({ nativeEvent }) => setAuthorId(nativeEvent.event === "all" ? null : nativeEvent.event)}
          >
            <View style={styles.pill}>
              <SymbolView name="person.2" size={15} tintColor={colors.label as string} />
              <Text style={[type.subhead, { color: colors.label }]} numberOfLines={1}>
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
              <Text style={[type.footnote, { color: colors.label, fontWeight: "600" }]}>Reintentar</Text>
            </Pressable>
          </View>
        )}
        {noPins && !error && (
          <View style={styles.notice}>
            <Text style={[type.footnote, styles.noticeText]}>Todavía no hay fotos en el mapa</Text>
          </View>
        )}
      </View>

      <View style={[styles.buttons, { top: insets.top + HEADER_HEIGHT + 64 + spacing.sm }]}>
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

      {/* ODbL obliga a mostrar la atribución mientras se ve el mapa: texto fijo, no tocable. */}
      <Text pointerEvents="none" style={[type.caption, styles.attribution, { bottom: barInset + 2 }]}>
        © OpenStreetMap · OpenFreeMap
      </Text>

      {carousel.length > 0 && detail && selection && (
        <View pointerEvents="box-none" style={[styles.cardWrap, { bottom: barInset + 18 }]}>
          <PinCarousel
            key={selection.ids.join()}
            items={carousel}
            index={selection.index}
            onIndexChange={(index) => setSelection({ ...selection, index })}
            timeZone={detail.trip.timezone}
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
  round: { ...chip, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  attribution: { position: "absolute", left: spacing.md, color: colors.secondaryLabel },
  cardWrap: { position: "absolute", left: 0, right: 0 },
});

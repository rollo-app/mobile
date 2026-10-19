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
import { boundsOf, feedToItems, mergeItems, toFeatures, type MapItem } from "@/features/map/features";
import { silenceTileNetworkErrors } from "@/features/map/log-filter";
import { PinCard } from "@/features/map/pin-card";
import { PinLayers } from "@/features/map/pin-layers";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);

  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const framed = useRef(false);

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
  const selected = selectedId ? items.find((i) => i.id === selectedId) ?? null : null;
  const noPins = shown.features.length === 0;

  // Si lo seleccionado queda afuera de los filtros, la tarjeta se va con el pin.
  useEffect(() => {
    if (selectedId && !shown.features.some((f) => f.properties.id === selectedId)) setSelectedId(null);
  }, [shown, selectedId]);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then((p) => setHasLocation(p.granted), () => {});
  }, []);

  const padding = useMemo(
    () => ({ top: insets.top + HEADER_HEIGHT + 64, right: 48, bottom: insets.bottom + 160, left: 48 }),
    [insets.top, insets.bottom],
  );

  // Al entrar: todos los pins a la vista; sin pins, donde estás (si hay permiso); si no, la región del viaje.
  useEffect(() => {
    if (!mapReady || framed.current) return;
    const bounds = boundsOf(all.features);
    if (bounds) {
      framed.current = true;
      if (all.features.length === 1) {
        cameraRef.current?.easeTo({ center: [bounds[0], bounds[1]], zoom: 13, duration: 0 });
      } else {
        cameraRef.current?.fitBounds(bounds, { padding, duration: 0 });
      }
    } else if (feed || error) {
      framed.current = true;
      void centerOnUser(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, all, feed, error, padding]);

  async function centerOnUser(ask: boolean) {
    try {
      const permission = ask
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      setHasLocation(permission.granted);
      if (!permission.granted) return;
      const position =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (position) {
        cameraRef.current?.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 13, duration: 600 });
      }
    } catch {
      // Sin ubicación el mapa queda donde está.
    }
  }

  const onPinsPress = useCallback((event: PressEvent) => {
    const feature = event.nativeEvent.features[0];
    if (!feature) return;
    event.stopPropagation?.();
    const props = feature.properties ?? {};
    if (props.cluster) {
      void sourceRef.current?.getClusterExpansionZoom(props.cluster_id).then((zoom) => {
        const center = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        cameraRef.current?.easeTo({ center, zoom, duration: 400 });
      });
    } else {
      setSelectedId(props.id);
    }
  }, []);

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
        attribution
        attributionPosition={{ bottom: insets.bottom + TAB_BAR_GAP, left: 8 }}
        onDidFinishLoadingMap={() => setMapReady(true)}
        onPress={() => setSelectedId(null)}
      >
        <Camera ref={cameraRef} initialViewState={DEFAULT_REGION} />
        {hasLocation && <UserLocation />}
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Centrar en mi ubicación"
        onPress={() => void centerOnUser(true)}
        style={[styles.locate, { top: insets.top + HEADER_HEIGHT + 64 + spacing.sm }]}
      >
        <SymbolView name="location.fill" size={17} tintColor={colors.label as string} />
      </Pressable>

      {selected && trip && detail && (
        <View pointerEvents="box-none" style={[styles.cardWrap, { bottom: insets.bottom + TAB_BAR_GAP + 8 }]}>
          <PinCard item={selected} timeZone={detail.trip.timezone} />
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
  locate: { ...chip, position: "absolute", right: spacing.md, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  cardWrap: { position: "absolute", left: spacing.md, right: spacing.md },
});

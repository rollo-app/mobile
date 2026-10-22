import { Camera, GeoJSONSource, Layer, Map, type InitialViewState } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { silenceTileNetworkErrors } from "@/features/map/log-filter";
import { writeStyleFile } from "@/features/map/style-file";
import { colors, radius, spacing, type } from "@/ui/theme";
import { zoneBounds, zoneFeatures, type FeaturedZone } from "./zones";

silenceTileNetworkErrors();

/** A zone is ~5 km: past this zoom the circle would suggest a precision the data doesn't have. */
const MAX_ZOOM = 11;
/** With a single zone (or all in one spot) there is nothing to fit: center with this zoom. */
const SINGLE_ZOOM = 9;
const HEIGHT = 340;
const PADDING = { top: 48, right: 48, bottom: 48, left: 48 };
const FONT = ["Noto Sans Bold"];

function initialView(zones: FeaturedZone[]): InitialViewState {
  const [w, s, e, n] = zoneBounds(zones)!;
  if (Math.max(e - w, n - s) < 0.05) return { center: [(w + e) / 2, (s + n) / 2], zoom: SINGLE_ZOOM };
  return { bounds: [w, s, e, n], padding: PADDING };
}

/**
 * Where a profile's featured photos were taken, as ~5 km zones: a circle per zone with how many photos
 * it has, never a pin per photo. It frames all zones. Neutral circles (like the roll map's clusters):
 * cobalt is only for actions and selection.
 */
export function FeaturedMap({ zones }: { zones: FeaturedZone[] }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const styleUri = useMemo(() => writeStyleFile(scheme), [scheme]);
  const data = useMemo(() => zoneFeatures(zones), [zones]);
  const view = useMemo(() => initialView(zones), [zones]);

  return (
    <View style={styles.wrap}>
      <View style={styles.map}>
        <Map key={styleUri} style={StyleSheet.absoluteFill} mapStyle={styleUri} logo={false} attribution={false} compass={false} touchRotate={false} touchPitch={false}>
          <Camera initialViewState={view} maxZoom={MAX_ZOOM} />
          <GeoJSONSource id="featured-zones" data={data}>
            <Layer
              id="featured-zones-circle"
              type="circle"
              paint={{
                "circle-color": "#1C1C1E",
                "circle-radius": ["step", ["get", "count"], 16, 5, 20, 20, 24],
                "circle-stroke-width": 2,
                "circle-stroke-color": "#FFFFFF",
              }}
            />
            <Layer
              id="featured-zones-count"
              type="symbol"
              layout={{
                "text-field": ["to-string", ["get", "count"]],
                "text-font": FONT,
                "text-size": 14,
                "text-allow-overlap": true,
              }}
              paint={{ "text-color": "#FFFFFF" }}
            />
          </GeoJSONSource>
        </Map>
      </View>
      {/* ODbL requires showing the attribution while the map is visible. */}
      <Text style={[type.caption, styles.attribution]}>© OpenStreetMap · OpenFreeMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  map: { height: HEIGHT, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.latent },
  attribution: { color: colors.secondaryLabel, paddingHorizontal: spacing.xs },
});

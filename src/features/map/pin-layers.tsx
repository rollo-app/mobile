import { GeoJSONSource, Layer, type FilterSpecification, type GeoJSONSourceRef } from "@maplibre/maplibre-react-native";
import type { Ref } from "react";
import type { NativeSyntheticEvent } from "react-native";
import type { PinCollection } from "./features";

const UNCLUSTERED: FilterSpecification = ["!", ["has", "point_count"]];
/** Greater than the map's max zoom (MAX_ZOOM): clustering always applies, two pins never overlap. */
export const CLUSTER_MAX_ZOOM = 18;
const FONT = ["Noto Sans Bold"];

type PressEvent = NativeSyntheticEvent<{ features: GeoJSON.Feature[] }>;

/**
 * Pins are native layers over a clustered source (no React markers, which
 * can't handle hundreds of photos): a circle in each author's color with their initial, and
 * dark clusters with the count. Pending ones (yours, not uploaded) appear dimmed.
 */
export function PinLayers({
  data,
  selectedId,
  haloColor,
  sourceRef,
  onPress,
}: {
  data: PinCollection;
  selectedId: string | null;
  /** Cobalt (hex) for the selected pin's halo. */
  haloColor: string;
  sourceRef: Ref<GeoJSONSourceRef>;
  onPress: (event: PressEvent) => void;
}) {
  return (
    <GeoJSONSource
      id="pins"
      ref={sourceRef}
      data={data}
      cluster
      clusterRadius={45}
      clusterMaxZoom={CLUSTER_MAX_ZOOM}
      onPress={onPress}
    >
      <Layer
        id="pins-cluster"
        type="circle"
        filter={["has", "point_count"]}
        paint={{
          "circle-color": "#1C1C1E",
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 22, 50, 26],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#FFFFFF",
        }}
      />
      <Layer
        id="pins-cluster-count"
        type="symbol"
        filter={["has", "point_count"]}
        layout={{
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": FONT,
          "text-size": 14,
          "text-allow-overlap": true,
        }}
        paint={{ "text-color": "#FFFFFF" }}
      />
      <Layer
        id="pins-photo"
        type="circle"
        filter={UNCLUSTERED}
        paint={{
          "circle-color": ["get", "color"],
          "circle-opacity": ["case", ["get", "pending"], 0.55, 1],
          "circle-radius": 15,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-opacity": ["case", ["get", "pending"], 0.7, 1],
        }}
      />
      <Layer
        id="pins-selected"
        type="circle"
        filter={["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], selectedId ?? ""]]}
        paint={{
          "circle-color": ["get", "color"],
          "circle-radius": 20,
          "circle-stroke-width": 3,
          "circle-stroke-color": haloColor,
        }}
      />
      <Layer
        id="pins-initial"
        type="symbol"
        filter={UNCLUSTERED}
        layout={{
          "text-field": ["get", "initial"],
          "text-font": FONT,
          "text-size": ["case", ["==", ["get", "id"], selectedId ?? ""], 18, 14],
          "text-allow-overlap": true,
        }}
        paint={{ "text-color": "#FFFFFF" }}
      />
    </GeoJSONSource>
  );
}

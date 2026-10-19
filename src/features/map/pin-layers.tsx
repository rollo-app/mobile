import { GeoJSONSource, Layer, type FilterSpecification, type GeoJSONSourceRef } from "@maplibre/maplibre-react-native";
import type { Ref } from "react";
import type { NativeSyntheticEvent } from "react-native";
import type { PinCollection } from "./features";

const UNCLUSTERED: FilterSpecification = ["!", ["has", "point_count"]];
/** Por encima de este zoom las fotos ya no se agrupan: las que siguen juntas van al carrusel. */
export const CLUSTER_MAX_ZOOM = 15;
const FONT = ["Noto Sans Bold"];

type PressEvent = NativeSyntheticEvent<{ features: GeoJSON.Feature[] }>;

/**
 * Los pins van como capas nativas sobre una fuente con clustering (nada de markers de React, que
 * no aguantan cientos de fotos): círculo del color de cada autor con su inicial, y clusters
 * oscuros con la cantidad. Las pendientes (tuyas, sin subir) se ven atenuadas.
 */
export function PinLayers({
  data,
  selectedId,
  sourceRef,
  onPress,
}: {
  data: PinCollection;
  selectedId: string | null;
  sourceRef: Ref<GeoJSONSourceRef>;
  onPress: (event: PressEvent) => void;
}) {
  return (
    <GeoJSONSource
      id="pins"
      ref={sourceRef}
      data={data}
      cluster
      clusterRadius={44}
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
          "circle-stroke-color": "#FFFFFF",
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

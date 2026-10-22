import type { GeoJSONSourceSpecification } from "@maplibre/maplibre-react-native";
import type { FeaturedPhoto } from "./actions";

/** A ~5 km zone (the center of its cell, as the server sends it) and how many featured photos are in it. */
export type FeaturedZone = { id: string; lat: number; lng: number; count: number };

export type ZoneCollection = GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; count: number }>;

/** Groups photos by their zone and counts them, biggest zone first. Photos without a zone are left out. */
export function zonesOf(photos: Pick<FeaturedPhoto, "zone">[]): FeaturedZone[] {
  const zones = new Map<string, FeaturedZone>();
  for (const { zone } of photos) {
    if (!zone) continue;
    const id = `zone:${zone.lat},${zone.lng}`;
    const found = zones.get(id);
    if (found) found.count += 1;
    else zones.set(id, { id, lat: zone.lat, lng: zone.lng, count: 1 });
  }
  return [...zones.values()].sort((a, b) => b.count - a.count);
}

/**
 * When zooming out, nearby zones merge into one circle (MapLibre clusters): it adds up their photos in
 * `total`, since `point_count` would be how many zones it has.
 */
export const ZONE_CLUSTER_PROPERTIES: GeoJSONSourceSpecification["clusterProperties"] = { total: ["+", ["get", "count"]] };

/** How many photos a circle stands for: a cluster's `total`, or a single zone's own `count`. */
export const ZONE_PHOTOS: ["coalesce", ["get", string], ["get", string]] = ["coalesce", ["get", "total"], ["get", "count"]];

/** One point per zone for the map source: only its id and count. */
export function zoneFeatures(zones: FeaturedZone[]): ZoneCollection {
  return {
    type: "FeatureCollection",
    features: zones.map((z) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [z.lng, z.lat] },
      properties: { id: z.id, count: z.count },
    })),
  };
}

/** [west, south, east, north] over all zones, or null without any. */
export function zoneBounds(zones: FeaturedZone[]): [number, number, number, number] | null {
  if (zones.length === 0) return null;
  const lngs = zones.map((z) => z.lng);
  const lats = zones.map((z) => z.lat);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

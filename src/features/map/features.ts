import type { Schemas } from "@/api/client";
import { memberColor } from "./member-color";

/** Una foto o video en el mapa: del feed del server o tuya de la cola local (pendiente). */
export type MapItem = {
  id: string;
  type: "photo" | "video";
  takenAt: number;
  day: string;
  lat: number | null;
  lng: number | null;
  caption: string | null;
  durationS: number | null;
  thumbhash: string | null;
  authorId: string;
  authorName: string;
  pending: boolean;
};

export type MapFilters = { day: string | null; authorId: string | null };

export type PinProperties = { id: string; initial: string; color: string; pending: boolean };
export type PinFeature = GeoJSON.Feature<GeoJSON.Point, PinProperties>;
export type PinCollection = GeoJSON.FeatureCollection<GeoJSON.Point, PinProperties>;

export function feedToItems(items: Schemas["FeedItem"][]): MapItem[] {
  return items.map((i) => ({
    id: i.id,
    type: i.type,
    takenAt: i.takenAt,
    day: i.day,
    lat: i.lat,
    lng: i.lng,
    caption: i.caption,
    durationS: i.durationS,
    thumbhash: i.thumbhash,
    authorId: i.author.id,
    authorName: i.author.name,
    pending: false,
  }));
}

/** Si una pendiente ya figura en el feed (recién subida), gana la del server. */
export function mergeItems(feed: MapItem[], pending: MapItem[]): MapItem[] {
  const ids = new Set(feed.map((i) => i.id));
  return [...feed, ...pending.filter((i) => !ids.has(i.id))];
}

/** Los items con esos ids, ordenados por hora de captura (para el carrusel). */
export function itemsByTime(items: MapItem[], ids: string[]): MapItem[] {
  const wanted = new Set(ids);
  return items.filter((i) => wanted.has(i.id)).sort((a, b) => a.takenAt - b.takenAt);
}

export function toFeatures(items: MapItem[], filters: MapFilters): PinCollection {
  const features: PinFeature[] = [];
  for (const i of items) {
    if (i.lat === null || i.lng === null) continue;
    if (filters.day && i.day !== filters.day) continue;
    if (filters.authorId && i.authorId !== filters.authorId) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [i.lng, i.lat] },
      properties: {
        id: i.id,
        initial: i.authorName.trim().charAt(0).toUpperCase(),
        color: memberColor(i.authorId),
        pending: i.pending,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Caja [oeste, sur, este, norte] que abarca los puntos; null si no hay ninguno. */
export function boundsOf(features: PinFeature[]): [number, number, number, number] | null {
  if (features.length === 0) return null;
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { geometry } of features) {
    const [lng, lat] = geometry.coordinates as [number, number];
    w = Math.min(w, lng);
    e = Math.max(e, lng);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return [w, s, e, n];
}

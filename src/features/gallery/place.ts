import type * as Location from "expo-location";
import type { RevealedPhoto } from "@/features/media/revealed";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Median lat and median lng of the chapter's photos that have GPS; null when none does. */
export function chapterCenter(photos: RevealedPhoto[]): { lat: number; lng: number } | null {
  const lats: number[] = [];
  const lngs: number[] = [];
  for (const p of photos) {
    if (p.lat === null || p.lng === null) continue;
    lats.push(p.lat);
    lngs.push(p.lng);
  }
  if (lats.length === 0) return null;
  return { lat: median(lats), lng: median(lngs) };
}

/** Rounded to 2 decimals (~1 km) so nearby chapters share one geocoding: "-41.13,-71.31". */
export function placeKey(c: { lat: number; lng: number }): string {
  return `${c.lat.toFixed(2)},${c.lng.toFixed(2)}`;
}

export function placeName(a: Location.LocationGeocodedAddress): string | null {
  return a.city ?? a.subregion ?? a.region ?? null;
}

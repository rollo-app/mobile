import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { CACHE_MAX_AGE } from "@/api/query-client";
import { placeKey, placeName } from "./place";

/**
 * The place name of a chapter's center (iOS geocoder), cached per ~1 km; null while loading, disabled or on error.
 * The center comes from all of the chapter's photos (not the filtered ones) so a filter never triggers a new lookup.
 */
export function useChapterPlace(center: { lat: number; lng: number } | null, enabled: boolean): string | null {
  const key = center ? placeKey(center) : "";
  const { data } = useQuery({
    queryKey: ["place", key],
    queryFn: async () => {
      const [address] = await Location.reverseGeocodeAsync({ latitude: center!.lat, longitude: center!.lng });
      return address ? placeName(address) : null;
    },
    staleTime: Infinity,
    // The brief asked for 30 days, but setTimeout overflows past ~24.8 days (gc would fire at once); the
    // persisted cache is cut at CACHE_MAX_AGE (7 days) anyway.
    gcTime: CACHE_MAX_AGE,
    retry: false,
    enabled: enabled && !!center,
  });
  return data ?? null;
}

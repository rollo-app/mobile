import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useMemo } from "react";
import type { RevealedPhoto } from "@/features/media/revealed";
import { CACHE_MAX_AGE } from "@/api/query-client";
import { chapterCenter, placeKey, placeName } from "./place";

/** The place name of a chapter (iOS geocoder), cached per ~1 km; null while loading, disabled or on error. */
export function useChapterPlace(photos: RevealedPhoto[], enabled: boolean): string | null {
  const center = useMemo(() => chapterCenter(photos), [photos]);
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

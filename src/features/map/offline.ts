import { OfflineManager, type LngLatBounds, type OfflinePackStatus } from "@maplibre/maplibre-react-native";

export type LngLat = [longitude: number, latitude: number];

/** Box [west, south, east, north] covering a circle of `radiusKm` around `center`. */
export function boundsAround([lng, lat]: LngLat, radiusKm: number): LngLatBounds {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

/**
 * Downloads an area for use without signal. Resolves with the final status (with `completedResourceSize`
 * in bytes) when it finishes; `onProgress` receives the percentage meanwhile.
 */
export async function downloadRegion(
  mapStyle: string,
  center: LngLat,
  radiusKm: number,
  minZoom: number,
  maxZoom: number,
  onProgress?: (status: OfflinePackStatus) => void,
): Promise<OfflinePackStatus> {
  // MapLibre Native caps tiles per device; 40 km at z14 is ~3,500.
  OfflineManager.setTileCountLimit(50_000);
  return new Promise<OfflinePackStatus>((resolve, reject) => {
    OfflineManager.createPack(
      { mapStyle, bounds: boundsAround(center, radiusKm), minZoom, maxZoom, metadata: { center, radiusKm, minZoom, maxZoom } },
      (_pack, status) => {
        onProgress?.(status);
        if (status.state === "complete") resolve(status);
      },
      (_pack, error) => reject(new Error(error.message)),
    ).catch(reject);
  });
}

export async function deleteAllRegions(): Promise<number> {
  const packs = await OfflineManager.getPacks();
  for (const pack of packs) await OfflineManager.deletePack(pack.id);
  return packs.length;
}

export const toMB = (bytes: number) => bytes / (1024 * 1024);

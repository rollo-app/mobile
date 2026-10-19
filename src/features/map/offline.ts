import { OfflineManager, type LngLatBounds, type OfflinePackStatus } from "@maplibre/maplibre-react-native";

export type LngLat = [longitude: number, latitude: number];

/** Caja [oeste, sur, este, norte] que cubre un círculo de `radiusKm` alrededor de `center`. */
export function boundsAround([lng, lat]: LngLat, radiusKm: number): LngLatBounds {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

/**
 * Baja una zona para usarla sin señal. Resuelve con el estado final (con `completedResourceSize`
 * en bytes) cuando termina; `onProgress` recibe el porcentaje mientras tanto.
 */
export async function downloadRegion(
  mapStyle: string,
  center: LngLat,
  radiusKm: number,
  minZoom: number,
  maxZoom: number,
  onProgress?: (status: OfflinePackStatus) => void,
): Promise<OfflinePackStatus> {
  // MapLibre Native corta en un tope de tiles por dispositivo; 40 km a z14 son ~3.500.
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

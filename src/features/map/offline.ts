import {
  OfflineManager,
  type LngLatBounds,
  type OfflinePack,
  type OfflinePackErrorListener,
  type OfflinePackProgressListener,
  type OfflinePackStatus,
} from "@maplibre/maplibre-react-native";

export type LngLat = [longitude: number, latitude: number];

/** A download that reports nothing for this long is given up on (the pack stays and is resumed on the next run). */
const STALL_MS = 60_000;

/** Box [west, south, east, north] covering a circle of `radiusKm` around `center`. */
export function boundsAround([lng, lat]: LngLat, radiusKm: number): LngLatBounds {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

/**
 * Resolves when the pack reports "complete". Per-resource errors are not fatal (MapLibre reports each
 * tile it can't fetch and keeps going), so they only make the message of a stall.
 */
function untilComplete(
  register: (progress: OfflinePackProgressListener, error: OfflinePackErrorListener) => Promise<unknown>,
  onProgress?: (status: OfflinePackStatus) => void,
): Promise<OfflinePackStatus> {
  return new Promise((resolve, reject) => {
    let lastError = "";
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => reject(new Error(lastError || "Se cortó la descarga")), STALL_MS);
    };
    arm();
    register(
      (_pack, status) => {
        arm();
        onProgress?.(status);
        if (status.state === "complete") {
          clearTimeout(timer);
          resolve(status);
        }
      },
      (_pack, error) => {
        lastError = error.message;
      },
    ).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export type RegionRequest = {
  /** Same URL the MapView uses, or the downloaded tiles are not found. */
  mapStyle: string;
  center: LngLat;
  radiusKm: number;
  minZoom: number;
  maxZoom: number;
  metadata: Record<string, unknown>;
};

/** Downloads an area for use without signal; resolves with the final status when it finishes. */
export async function downloadRegion(
  { mapStyle, center, radiusKm, minZoom, maxZoom, metadata }: RegionRequest,
  onProgress?: (status: OfflinePackStatus) => void,
): Promise<OfflinePackStatus> {
  // MapLibre Native caps tiles per device; 40 km at z14 is ~3,500.
  OfflineManager.setTileCountLimit(50_000);
  return untilComplete(
    (progress, error) =>
      OfflineManager.createPack({ mapStyle, bounds: boundsAround(center, radiusKm), minZoom, maxZoom, metadata }, progress, error),
    onProgress,
  );
}

/** Continues a pack that was interrupted (app closed, signal lost). */
export async function resumeRegion(pack: OfflinePack, onProgress?: (status: OfflinePackStatus) => void): Promise<OfflinePackStatus> {
  try {
    return await untilComplete(async (progress, error) => {
      await OfflineManager.addListener(pack.id, progress, error);
      await pack.resume();
    }, onProgress);
  } finally {
    OfflineManager.removeListener(pack.id);
  }
}

export async function deleteAllRegions(): Promise<number> {
  const packs = await OfflineManager.getPacks();
  for (const pack of packs) await OfflineManager.deletePack(pack.id);
  await OfflineManager.clearAmbientCache();
  return packs.length;
}

export const toMB = (bytes: number) => bytes / (1024 * 1024);

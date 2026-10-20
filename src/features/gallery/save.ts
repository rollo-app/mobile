import { File, Paths } from "expo-file-system";
import { Album, Asset, requestPermissionsAsync } from "expo-media-library";
import { API_URL } from "@/config";
import type { RevealedPhoto } from "@/features/media/revealed";

const CONCURRENCY = 3;
const ATTEMPTS = 2;
// The feed doesn't say how big the originals are: rough sizes for the confirmation message.
const PHOTO_BYTES = 3 * 1024 * 1024;
const VIDEO_BYTES = 20 * 1024 * 1024;

/** The user refused access to Photos. `canAskAgain` false means only Settings can change it. */
export class PermissionDeniedError extends Error {
  constructor(readonly canAskAgain: boolean) {
    super("Sin permiso para guardar en Fotos");
  }
}

export const albumTitle = (tripName: string) => `Rollo · ${tripName}`;

export function estimateBytes(photos: RevealedPhoto[]): number {
  return photos.reduce((sum, p) => sum + (p.type === "video" ? VIDEO_BYTES : PHOTO_BYTES), 0);
}

export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toLocaleString("es-AR", { maximumFractionDigits: 1 })} GB`;
  return `${Math.round(mb)} MB`;
}

export type SaveContext = { token: string; albumName: string; baseUrl?: string };

/**
 * Saves originals into the roll's album in Photos. Downloads run in parallel; creating the album
 * (or finding it) is serialized so concurrent saves don't create it twice.
 */
export function createSaver({ token, albumName, baseUrl = API_URL }: SaveContext) {
  let album: Album | null = null;
  let lock: Promise<unknown> = Promise.resolve();

  async function addToAlbum(path: string) {
    const task = lock.then(async () => {
      album ??= await Album.get(albumName);
      if (album) return void (await Asset.create(path, album));
      const asset = await Asset.create(path);
      album = await Album.create(albumName, [asset]);
    });
    lock = task.catch(() => {});
    await task;
  }

  return async function save(photo: RevealedPhoto): Promise<void> {
    const permission = await requestPermissionsAsync(true);
    if (!permission.granted) throw new PermissionDeniedError(permission.canAskAgain);
    const extension = photo.type === "video" ? "mp4" : "jpg";
    const target = new File(Paths.cache, `save-${photo.id}-${Math.random().toString(36).slice(2, 8)}.${extension}`);
    try {
      const file = await File.downloadFileAsync(`${baseUrl}${photo.originalPath}`, target, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await addToAlbum(file.uri);
    } finally {
      try {
        target.delete();
      } catch {
        // The temp file may not exist if the download failed early.
      }
    }
  };
}

export type DownloadResult = { saved: number; failed: RevealedPhoto[]; cancelled: boolean };

/**
 * Runs `save` over all photos, 3 at a time. Each one gets a second try; the ones that still fail
 * are returned. Cancelling stops starting new ones. A denied permission aborts everything.
 */
export async function downloadAll(
  photos: RevealedPhoto[],
  save: (photo: RevealedPhoto) => Promise<void>,
  { signal, onProgress }: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void },
): Promise<DownloadResult> {
  let next = 0;
  let done = 0;
  let saved = 0;
  const failed: RevealedPhoto[] = [];
  let denied: PermissionDeniedError | null = null;

  async function worker() {
    while (!signal?.aborted && !denied && next < photos.length) {
      const photo = photos[next++]!;
      let ok = false;
      for (let attempt = 0; attempt < ATTEMPTS && !ok; attempt++) {
        try {
          await save(photo);
          ok = true;
        } catch (error) {
          if (error instanceof PermissionDeniedError) {
            denied = error;
            return;
          }
        }
      }
      if (ok) saved++;
      else failed.push(photo);
      onProgress?.(++done, photos.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, photos.length) }, worker));
  if (denied) throw denied;
  return { saved, failed, cancelled: !!signal?.aborted && done < photos.length };
}

import { File, Paths } from "expo-file-system";
import { Album, Asset, requestPermissionsAsync } from "expo-media-library";
import { API_URL } from "@/config";
import { embedMetadataIfMissing } from "@/features/exif/embed";
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

/**
 * Every image to save: each moment's linked image goes right after its main photo (it has no feed item of its own).
 * It carries the main's author, time and place so Photos sorts and names it like the main.
 */
export function withLinkedImages(photos: RevealedPhoto[]): RevealedPhoto[] {
  return photos.flatMap((p) => (p.selfie ? [p, linkedImage(p)] : [p]));
}

/** The linked image of a moment as a photo of its own (to save it). */
export function linkedImage(main: RevealedPhoto): RevealedPhoto {
  const linked = main.selfie!;
  return {
    ...main,
    id: linked.id,
    type: "photo",
    caption: null,
    durationS: null,
    width: linked.width,
    height: linked.height,
    thumbhash: linked.thumbhash,
    thumbPath: linked.thumbPath,
    originalPath: linked.originalPath,
    selfie: null,
  };
}

export function estimateBytes(photos: RevealedPhoto[]): number {
  return photos.reduce((sum, p) => sum + (p.type === "video" ? VIDEO_BYTES : PHOTO_BYTES), 0);
}

export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toLocaleString("es-AR", { maximumFractionDigits: 1 })} GB`;
  return `${Math.round(mb)} MB`;
}

export type SaveContext = {
  token: string;
  albumName: string;
  /** The roll's IANA zone, for the local time written into photos that arrive without EXIF. */
  timeZone?: string;
  baseUrl?: string;
};

/**
 * Full access to the library: iOS requires it to find or create albums (`Album.get`/`Album.create`),
 * while adding assets only needs add-only permission. False means "save to Recents instead".
 */
export async function requestAlbumAccess(): Promise<boolean> {
  const permission = await requestPermissionsAsync(false);
  return permission.granted && (permission as { accessPrivileges?: string }).accessPrivileges === "all";
}

/**
 * Saves originals to Photos. By default they go to Recents (add-only permission, no album);
 * with `{ album: true }` they go into the roll's album, which needs `requestAlbumAccess()` first.
 * Downloads run in parallel; creating the album (or finding it) is serialized so concurrent saves
 * don't create it twice.
 */
export function createSaver({
  token,
  albumName,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  baseUrl = API_URL,
}: SaveContext) {
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

  return async function save(
    photo: RevealedPhoto,
    { album: inAlbum = false }: { album?: boolean } = {},
  ): Promise<void> {
    const permission = await requestPermissionsAsync(true);
    if (!permission.granted) throw new PermissionDeniedError(permission.canAskAgain);
    const extension = photo.type === "video" ? "mp4" : "jpg";
    const target = new File(Paths.cache, `save-${photo.id}-${Math.random().toString(36).slice(2, 8)}.${extension}`);
    try {
      const file = await File.downloadFileAsync(`${baseUrl}${photo.originalPath}`, target, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Photos uploaded before Rollo wrote EXIF (and the seed) arrive without a date: without it
      // they would sort by download time. Videos keep the creation date of the file the camera exported.
      if (photo.type === "photo") {
        await embedMetadataIfMissing(file, {
          takenAt: photo.takenAt,
          timeZone,
          location: photo.lat != null && photo.lng != null ? { lat: photo.lat, lng: photo.lng, accuracyM: null } : null,
          caption: photo.caption,
          author: photo.author.name,
        });
      }
      if (inAlbum) await addToAlbum(file.uri);
      else await Asset.create(file.uri);
    } finally {
      try {
        target.delete();
      } catch {
        // The temp file may not exist if the download failed early.
      }
    }
  };
}

export type DownloadResult = {
  saved: number;
  failed: RevealedPhoto[];
  cancelled: boolean;
};

/**
 * Runs `save` over all photos, 3 at a time. Each one gets a second try; the ones that still fail
 * are returned. Cancelling stops starting new ones. A denied permission aborts everything.
 */
export async function downloadAll(
  photos: RevealedPhoto[],
  save: (photo: RevealedPhoto) => Promise<void>,
  {
    signal,
    onProgress,
  }: {
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
  },
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
  return {
    saved,
    failed,
    cancelled: !!signal?.aborted && done < photos.length,
  };
}

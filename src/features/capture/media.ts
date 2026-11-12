import { Directory, File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { CapturedPhoto } from "@/features/camera/captured-photo";
import type { ExifInput } from "@/features/exif/build-exif";
import { embedMetadata } from "@/features/exif/embed";

/** Photos at print resolution; the thumb is what shows in the gallery. */
const ORIGINAL_MAX = 4000;
const THUMB_MAX = 800;
/** What the app shows full screen and what stays forever once the original is purged (the server caps it at 4 MB). */
const DISPLAY_MAX = 2048;

export type PreparedMedia = {
  originalUri: string;
  thumbUri: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  durationS: number | null;
  thumbhash: string | null;
  /** 2048 px JPEG with the same metadata as the original (photos only). */
  displayUri: string | null;
  displaySizeBytes: number | null;
};

/**
 * Prepares a photo for the queue: original (≤4000 px JPEG 88 %), 2048 px display (JPEG 82 %, same metadata) for viewing, 800 px thumb and its ThumbHash.
 * `options.maxDimension` lowers the photo's long side (the front camera of a moment is 1080 px).
 * Resizing re-encodes the JPEG and drops its EXIF, so photos get theirs written back from `metadata`
 * (time in the roll's zone, GPS, caption, author).
 * Everything goes to Documents (not the cache, which iOS may clear during days without signal) and is
 * deleted only once the server confirms the upload.
 */
export async function prepareMedia(
  photo: CapturedPhoto,
  id: string,
  metadata: ExifInput,
  options: { maxDimension?: number } = {},
): Promise<PreparedMedia> {
  const dir = new Directory(Paths.document, "pending", id);
  dir.create({ intermediates: true, idempotent: true });

  const original = new File(dir, "original.jpg");
  const thumb = new File(dir, "thumb.jpg");
  const display = new File(dir, "display.jpg");

  const saved = await saveResized(photo.uri, photo.width, photo.height, options.maxDimension ?? ORIGINAL_MAX, 0.88, original);
  // Best effort: a photo without metadata is still worth sending.
  await embedMetadata(original, metadata).catch(() => {});
  // The display comes from the finished original. A photo already within 2048 px (the front camera of a
  // moment, 1080 px) is not re-encoded: the original's bytes, metadata included, are the display.
  // Best effort: without a display the photo uploads as before and the server keeps its original forever.
  let displayReady = true;
  try {
    if (Math.max(saved.width, saved.height) <= DISPLAY_MAX) {
      original.copy(display);
    } else {
      await saveResized(original.uri, saved.width, saved.height, DISPLAY_MAX, 0.82, display);
      await embedMetadata(display, metadata).catch(() => {});
    }
  } catch {
    displayReady = false;
  }
  await saveResized(original.uri, saved.width, saved.height, THUMB_MAX, 0.8, thumb);
  await deleteQuietly(photo.uri);

  return {
    originalUri: original.uri,
    thumbUri: thumb.uri,
    width: saved.width,
    height: saved.height,
    sizeBytes: original.size ?? 0,
    durationS: null,
    displayUri: displayReady ? display.uri : null,
    displaySizeBytes: displayReady ? display.size ?? 0 : null,
    thumbhash: await Image.generateThumbhashAsync(thumb.uri).catch(() => null),
  };
}

export async function discard(uri: string) {
  await deleteQuietly(uri);
}

async function saveResized(uri: string, w: number, h: number, max: number, compress: number, dest: File) {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(w, h) > max) ctx.resize(w >= h ? { width: max } : { height: max });
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ compress, format: SaveFormat.JPEG });
  await new File(result.uri).move(dest);
  return { width: result.width, height: result.height };
}

async function deleteQuietly(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Temp file: if it could not be deleted, the system cleans it up.
  }
}

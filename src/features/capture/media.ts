import { Directory, File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";

/** Fotos a resolución de impresión; el thumb es lo que se ve en la galería. */
const ORIGINAL_MAX = 4000;
const THUMB_MAX = 800;

export type PreparedMedia = {
  originalUri: string;
  thumbUri: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  durationS: number | null;
  thumbhash: string | null;
};

/**
 * Deja lista una captura para la cola: original (foto ≤4000 px JPEG 88 % o el video
 * ya exportado a 1080p por la cámara), thumb de 800 px y su ThumbHash.
 * Todo va a Documents (no al caché, que iOS puede vaciar en días sin señal) y se
 * borra recién cuando el server confirma la subida.
 */
export async function prepareMedia(asset: ImagePickerAsset, id: string): Promise<PreparedMedia> {
  const dir = new Directory(Paths.document, "pending", id);
  dir.create({ intermediates: true, idempotent: true });

  const isVideo = asset.type === "video";
  const original = new File(dir, isVideo ? "original.mp4" : "original.jpg");
  const thumb = new File(dir, "thumb.jpg");

  let width: number | null = asset.width || null;
  let height: number | null = asset.height || null;

  if (isVideo) {
    await new File(asset.uri).move(original);
    const frame = await VideoThumbnails.getThumbnailAsync(original.uri, { time: 0, quality: 0.9 });
    await saveResized(frame.uri, frame.width, frame.height, THUMB_MAX, 0.8, thumb);
    await deleteQuietly(frame.uri);
  } else {
    const saved = await saveResized(asset.uri, asset.width, asset.height, ORIGINAL_MAX, 0.88, original);
    width = saved.width;
    height = saved.height;
    await saveResized(original.uri, saved.width, saved.height, THUMB_MAX, 0.8, thumb);
    await deleteQuietly(asset.uri);
  }

  return {
    originalUri: original.uri,
    thumbUri: thumb.uri,
    width,
    height,
    sizeBytes: original.size ?? 0,
    durationS: isVideo && asset.duration ? Math.round(asset.duration / 100) / 10 : null,
    thumbhash: await Image.generateThumbhashAsync(thumb.uri).catch(() => null),
  };
}

/** Primer cuadro del video para el preview. */
export async function videoPoster(uri: string): Promise<string> {
  return (await VideoThumbnails.getThumbnailAsync(uri, { time: 0 })).uri;
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
    // Archivo temporal: si no se pudo borrar, lo limpia el sistema.
  }
}

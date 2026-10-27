import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { CapturedPhoto } from "./captured-photo";
import { centerCropTo43 } from "./frame";

/**
 * The shot as it is kept: 4:3 (untouched when it is, centered crop — never a stretch — when it isn't) and, with `mirror`,
 * flipped horizontally: a front photo comes out as its mirrored preview showed it, unlike iOS's camera. When that makes
 * a new file, the camera's one is deleted.
 */
export async function ensureFourThree(photo: CapturedPhoto, options: { mirror?: boolean } = {}): Promise<CapturedPhoto> {
  const rect = centerCropTo43(photo.width, photo.height);
  if (!rect && !options.mirror) return photo;
  try {
    const ctx = ImageManipulator.manipulate(photo.uri);
    if (options.mirror) ctx.flip("horizontal");
    if (rect) ctx.crop(rect);
    const image = await ctx.renderAsync();
    const saved = await image.saveAsync({ compress: 1, format: SaveFormat.JPEG });
    deleteQuietly(photo.uri);
    return { uri: saved.uri, width: saved.width, height: saved.height };
  } catch {
    // Better the original than no photo.
    return photo;
  }
}

function deleteQuietly(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A temp file: the system cleans it up.
  }
}

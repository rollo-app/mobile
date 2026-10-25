import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { CapturedPhoto } from "./captured-photo";
import { centerCropTo43 } from "./frame";

/** Makes sure a shot is 4:3: untouched when it is, centered crop (never a stretch) when it isn't. */
export async function ensureFourThree(photo: CapturedPhoto): Promise<CapturedPhoto> {
  const rect = centerCropTo43(photo.width, photo.height);
  if (!rect) return photo;
  try {
    const image = await ImageManipulator.manipulate(photo.uri).crop(rect).renderAsync();
    const saved = await image.saveAsync({ compress: 1, format: SaveFormat.JPEG });
    return { uri: saved.uri, width: saved.width, height: saved.height };
  } catch {
    // Better the original than no photo.
    return photo;
  }
}

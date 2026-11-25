import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { CropRect } from "./crop-math";
import type { Photo } from "./crop-request";

/** Cuts the chosen area and saves it as a JPEG of at most `size` px wide, keeping the area's aspect (never upscaled). */
export async function cropImage(uri: string, rect: CropRect, size: number): Promise<Photo> {
  const width = Math.min(size, rect.width);
  const height = Math.round((width * rect.height) / rect.width);
  const image = await ImageManipulator.manipulate(uri).crop(rect).resize({ width, height }).renderAsync();
  const saved = await image.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
  return { uri: saved.uri, width, height };
}

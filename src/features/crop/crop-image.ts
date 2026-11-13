import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { CropRect } from "./crop-math";
import type { Photo } from "./crop-request";

/** Cuts the chosen square and saves it as a JPEG of at most `size` px a side (never upscaled). */
export async function cropImage(uri: string, rect: CropRect, size: number): Promise<Photo> {
  const side = Math.min(size, rect.width);
  const image = await ImageManipulator.manipulate(uri).crop(rect).resize({ width: side, height: side }).renderAsync();
  const saved = await image.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: side, height: side };
}

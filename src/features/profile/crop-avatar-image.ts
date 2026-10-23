import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { CropRect } from "./crop-math";
import type { Photo } from "./crop-request";

const AVATAR_SIZE = 512;

/** Cuts the square under the circle and makes it the 512×512 JPEG the avatar upload expects. */
export async function cropAvatarImage(uri: string, rect: CropRect): Promise<Photo> {
  const image = await ImageManipulator.manipulate(uri)
    .crop(rect)
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE })
    .renderAsync();
  const saved = await image.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: AVATAR_SIZE, height: AVATAR_SIZE };
}

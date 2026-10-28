/** Width over height of the camera's frame: the sensor takes 4:3, shown upright as 3:4 (like the iPhone's camera). */
export const FRAME_ASPECT = 3 / 4;

export type CropRect = { originX: number; originY: number; width: number; height: number };

/**
 * The centered crop that makes a photo exactly 4:3 (in its own orientation; a square counts as portrait), or `null` when
 * it already is (within a pixel or two of rounding). The camera already hands back 4:3 when its view is 3:4, so this is
 * only a safety net: it never stretches.
 */
export function centerCropTo43(width: number, height: number): CropRect | null {
  const portrait = width <= height;
  const long = portrait ? height : width;
  const short = portrait ? width : height;
  if (Math.abs(long * 3 - short * 4) <= 4) return null;
  let cropLong = Math.round((short * 4) / 3);
  let cropShort = short;
  if (cropLong > long) {
    cropLong = long;
    cropShort = Math.round((long * 3) / 4);
  }
  const w = portrait ? cropShort : cropLong;
  const h = portrait ? cropLong : cropShort;
  return { originX: Math.round((width - w) / 2), originY: Math.round((height - h) / 2), width: w, height: h };
}

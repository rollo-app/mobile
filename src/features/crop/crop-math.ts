/**
 * Math for the profile photo crop: the photo sits behind a circle of `diameter` points and can be zoomed
 * and moved, but the circle must always be covered. Zoom is relative to the scale that makes the photo's
 * short side as wide as the circle (1 = just covers it). The offset is how far the photo's center is from
 * the circle's center, in screen points.
 */

export const MAX_ZOOM = 4;

export type Size = { width: number; height: number };
export type Offset = { x: number; y: number };
export type CropRect = { originX: number; originY: number; width: number; height: number };

/** Screen points per source pixel at zoom 1: the short side fills the circle. */
export function minScale(image: Size, diameter: number): number {
  return diameter / Math.min(image.width, image.height);
}

/** The photo's size on screen at this zoom. */
export function displayedSize(image: Size, diameter: number, zoom: number): Size {
  const scale = minScale(image, diameter) * zoom;
  return { width: image.width * scale, height: image.height * scale };
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(1, zoom));
}

const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value)) + 0; // + 0 turns -0 into 0

/** Moves the photo back so its edges never enter the circle. */
export function clampOffset(offset: Offset, image: Size, diameter: number, zoom: number): Offset {
  const shown = displayedSize(image, diameter, zoom);
  return {
    x: clamp(offset.x, Math.max(0, (shown.width - diameter) / 2)),
    y: clamp(offset.y, Math.max(0, (shown.height - diameter) / 2)),
  };
}

/** The square under the circle, in source pixels (whole numbers, inside the photo). */
export function cropRect(image: Size, diameter: number, zoom: number, offset: Offset): CropRect {
  const z = clampZoom(zoom);
  const { x, y } = clampOffset(offset, image, diameter, z);
  const scale = minScale(image, diameter) * z;
  const side = Math.min(Math.round(diameter / scale), image.width, image.height);
  const fit = (origin: number, length: number) => Math.min(Math.max(0, Math.round(origin)), length - side);
  return {
    originX: fit(image.width / 2 - x / scale - side / 2, image.width),
    originY: fit(image.height / 2 - y / scale - side / 2, image.height),
    width: side,
    height: side,
  };
}

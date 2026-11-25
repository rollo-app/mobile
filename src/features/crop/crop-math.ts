/**
 * Math for the photo crop: the photo sits behind a frame (a circle or square of `diameter` points, or a 3:4 portrait
 * rectangle) and can be zoomed and moved, but the frame must always be covered. Zoom is relative to the scale that
 * just covers the frame (1 = covers it exactly). The offset is how far the photo's center is from the frame's center,
 * in screen points. Wherever a `frame` is taken, a number means a square of that side.
 */

export const MAX_ZOOM = 4;

export type Size = { width: number; height: number };
export type Offset = { x: number; y: number };
export type Frame = number | Size;
export type CropRect = { originX: number; originY: number; width: number; height: number };

const size = (frame: Frame): Size => (typeof frame === "number" ? { width: frame, height: frame } : frame);

/** The largest 3:4 (width:height) frame that fits `gutter` points from each side and `availableHeight`. */
export function portraitFrame(windowWidth: number, availableHeight: number, gutter: number): Size {
  // A multiple of 3 so the height is a whole number and the ratio is exactly 3:4.
  const width = Math.floor(Math.min(windowWidth - 2 * gutter, (availableHeight * 3) / 4) / 3) * 3;
  return { width, height: (width * 4) / 3 };
}

/** Screen points per source pixel at zoom 1: the photo just covers the frame. */
export function minScale(image: Size, frame: Frame): number {
  const f = size(frame);
  return Math.max(f.width / image.width, f.height / image.height);
}

/** The photo's size on screen at this zoom. */
export function displayedSize(image: Size, frame: Frame, zoom: number): Size {
  const scale = minScale(image, frame) * zoom;
  return { width: image.width * scale, height: image.height * scale };
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(1, zoom));
}

const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value)) + 0; // + 0 turns -0 into 0

/** Moves the photo back so its edges never enter the frame. */
export function clampOffset(offset: Offset, image: Size, frame: Frame, zoom: number): Offset {
  const shown = displayedSize(image, frame, zoom);
  const f = size(frame);
  return {
    x: clamp(offset.x, Math.max(0, (shown.width - f.width) / 2)),
    y: clamp(offset.y, Math.max(0, (shown.height - f.height) / 2)),
  };
}

/** The area under the frame, in source pixels (whole numbers, inside the photo; same aspect as the frame). */
export function cropRect(image: Size, frame: Frame, zoom: number, offset: Offset): CropRect {
  const z = clampZoom(zoom);
  const { x, y } = clampOffset(offset, image, frame, z);
  const scale = minScale(image, frame) * z;
  const f = size(frame);
  // Height follows the width at the frame's aspect, so a 3:4 frame always yields an exact 3:4 rect.
  let width = Math.min(Math.round(f.width / scale), image.width);
  let height = Math.round((width * f.height) / f.width);
  if (height > image.height) {
    height = image.height;
    width = Math.round((height * f.width) / f.height);
  }
  const fit = (origin: number, length: number, extent: number) => Math.min(Math.max(0, Math.round(origin)), length - extent);
  return {
    originX: fit(image.width / 2 - x / scale - width / 2, image.width, width),
    originY: fit(image.height / 2 - y / scale - height / 2, image.height, height),
    width,
    height,
  };
}

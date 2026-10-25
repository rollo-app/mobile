export type Touch = { pageX: number; pageY: number };

/** The camera's `zoom` goes from 0 (none) to 1 (the device's max). A full-sensitivity pinch is gentle on purpose. */
const SENSITIVITY = 0.5;

export function touchDistance(touches: readonly Touch[]) {
  const [a, b] = touches;
  return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
}

/** The zoom after fingers that started `startDistance` apart (at `startZoom`) are now `distance` apart. */
export function pinchZoom(startZoom: number, startDistance: number, distance: number) {
  if (startDistance <= 0) return startZoom;
  const next = startZoom + (distance / startDistance - 1) * SENSITIVITY;
  return Math.min(1, Math.max(0, next));
}

import type { PinFeature } from "./features";

/** Max map zoom. With `clusterMaxZoom` above it, clustering applies at every possible zoom. */
export const MAX_ZOOM = 17;
/** Max zoom when framing, even if everything fits within a few meters. */
export const FIT_MAX_ZOOM = 15;
/** Distance in screen pixels within which two photos count as "the same spot". */
export const SAME_SPOT_PX = 24;

export function isTripActive(trip: { startsAt: number; endsAt: number }, now: number): boolean {
  return now >= trip.startsAt && now <= trip.endsAt;
}

type Bounds = [number, number, number, number];

export type FitTarget = { kind: "bounds"; bounds: Bounds } | { kind: "center"; center: [number, number]; zoom: number };

/**
 * How to frame the pins. If they are all at almost the same point, `fitBounds` would zoom to the
 * max and they would end up ungrouped (clustering stops at `clusterMaxZoom`): center with a fixed zoom instead.
 */
export function fitTarget(bounds: Bounds): FitTarget {
  const [w, s, e, n] = bounds;
  // At zoom 15, ~0.006° (~300 screen px) fit: with less than that, fitBounds would exceed FIT_MAX_ZOOM.
  if (Math.max(e - w, n - s) < 0.006) return { kind: "center", center: [(w + e) / 2, (s + n) / 2], zoom: FIT_MAX_ZOOM };
  return { kind: "bounds", bounds };
}

/**
 * The photos that are "in the same spot" as `center` at this zoom: within SAME_SPOT_PX pixels
 * (those with identical coordinates always). Always includes the closest one.
 */
export function photosNear(features: PinFeature[], center: [number, number], zoom: number): PinFeature[] {
  const degPerPx = 360 / (512 * 2 ** zoom);
  const maxDeg = SAME_SPOT_PX * degPerPx;
  const dist = (f: PinFeature) => Math.hypot(...(f.geometry.coordinates.map((c, i) => c - center[i]!) as [number, number]));
  const near = features.filter((f) => dist(f) <= maxDeg);
  if (near.length === 0) {
    const closest = [...features].sort((a, b) => dist(a) - dist(b))[0];
    if (closest) near.push(closest);
  }
  return near;
}

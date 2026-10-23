import type { InitialViewState } from "@maplibre/maplibre-react-native";
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

/** Zoom when the map starts (or recenters) on you with the trip in progress. */
export const USER_ZOOM = 12;
/** Zoom when the map starts on you only because there is nothing else to show: your city. */
export const CITY_ZOOM = 10;
/** With no pins and no location: the whole world, neutral (never a hardcoded region). */
export const WORLD_VIEW = { center: [0, 20] as [number, number], zoom: 1 };

type Bounds = [number, number, number, number];
type Padding = { top: number; right: number; bottom: number; left: number };

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

/**
 * Where the map starts, decided before showing it: with the trip in progress and your position, where
 * you are; otherwise all the pins; with no pins, your position at city level; with nothing, the world.
 * `position` is [lng, lat] and only present when location permission was already granted.
 */
export function startView(input: {
  active: boolean;
  position: [number, number] | null;
  bounds: Bounds | null;
  padding: Padding;
}): InitialViewState {
  const { active, position, bounds, padding } = input;
  if (active && position) return { center: position, zoom: USER_ZOOM };
  if (bounds) {
    const target = fitTarget(bounds);
    return target.kind === "center" ? { center: target.center, zoom: target.zoom } : { bounds: target.bounds, padding };
  }
  if (position) return { center: position, zoom: CITY_ZOOM };
  return WORLD_VIEW;
}

/**
 * The zoom the map starts at, for the "same spot" radius until the map reports its own. For a box it is
 * an estimate: the zoom at which its widest side fills one 512 px tile, capped at FIT_MAX_ZOOM.
 */
export function startZoom(view: InitialViewState): number {
  if ("zoom" in view && typeof view.zoom === "number") return view.zoom;
  if ("bounds" in view && view.bounds) {
    const [w, s, e, n] = view.bounds;
    const span = Math.max(e - w, n - s, 1e-6);
    return Math.min(FIT_MAX_ZOOM, Math.max(0, Math.log2(360 / span)));
  }
  return WORLD_VIEW.zoom;
}

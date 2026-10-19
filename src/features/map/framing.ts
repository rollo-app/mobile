import type { PinFeature } from "./features";

/** El zoom máximo con el que se encuadra: por debajo del `clusterMaxZoom`, así las fotos juntas se agrupan. */
export const FIT_MAX_ZOOM = 14;
/** Distancia en píxeles de pantalla dentro de la cual dos fotos cuentan como "el mismo lugar". */
export const SAME_SPOT_PX = 24;

export function isTripActive(trip: { startsAt: number; endsAt: number }, now: number): boolean {
  return now >= trip.startsAt && now <= trip.endsAt;
}

type Bounds = [number, number, number, number];

export type FitTarget = { kind: "bounds"; bounds: Bounds } | { kind: "center"; center: [number, number]; zoom: number };

/**
 * Cómo encuadrar los pins. Si están todos casi en el mismo punto, `fitBounds` haría zoom al
 * máximo y quedarían desagrupados (el clustering corta en `clusterMaxZoom`): se centra con un zoom fijo.
 */
export function fitTarget(bounds: Bounds): FitTarget {
  const [w, s, e, n] = bounds;
  // Con 0.02° (~2 km) de lado ya cabe a zoom FIT_MAX_ZOOM en cualquier pantalla.
  if (Math.max(e - w, n - s) < 0.02) return { kind: "center", center: [(w + e) / 2, (s + n) / 2], zoom: FIT_MAX_ZOOM };
  return { kind: "bounds", bounds };
}

/**
 * Las fotos que están "en el mismo lugar" que `center` a este zoom: a menos de SAME_SPOT_PX píxeles
 * (las de coordenadas idénticas siempre). Siempre incluye la más cercana.
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

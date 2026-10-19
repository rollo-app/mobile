import type { PinFeature } from "./features";

/** Zoom máximo del mapa. Con `clusterMaxZoom` por encima, el clustering rige en todos los zooms posibles. */
export const MAX_ZOOM = 17;
/** Zoom máximo al encuadrar, aunque todo entre en pocos metros. */
export const FIT_MAX_ZOOM = 15;
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
  // A zoom 15 entran ~0.006° (~300 px de pantalla): con menos que eso, fitBounds pasaría de FIT_MAX_ZOOM.
  if (Math.max(e - w, n - s) < 0.006) return { kind: "center", center: [(w + e) / 2, (s + n) / 2], zoom: FIT_MAX_ZOOM };
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

/** ¿Tocar el cluster lo abre con zoom? No si el zoom necesario no existe o ya estamos al tope: van al carrusel. */
export function canExpandCluster(expansionZoom: number | undefined, currentZoom: number): boolean {
  return expansionZoom !== undefined && expansionZoom <= MAX_ZOOM && currentZoom < MAX_ZOOM - 0.5;
}

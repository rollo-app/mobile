import * as maplibregl from "maplibre-gl";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { buildMapStyle } from "../../../src/features/map/style";

export type Camera = { lng: number; lat: number; zoom: number };
export type Point = { x: number; y: number };

// Webpack emits the worker as an asset; MapLibre loads it by URL.
maplibregl.setWorkerUrl(new URL("../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

/** Labels in Spanish, like a Spanish-language iPhone; never Cyrillic or Arabic. */
function spanishLabels(style: maplibregl.StyleSpecification): maplibregl.StyleSpecification {
  const layers = style.layers.map((l) =>
    l.type === "symbol" && l.layout?.["text-field"] !== undefined
      ? { ...l, layout: { ...l.layout, "text-field": ["coalesce", ["get", "name:es"], ["get", "name:latin"], ["get", "name"]] } }
      : l,
  );
  return { ...style, layers } as maplibregl.StyleSpecification;
}

const TIMEOUT = { timeoutInMilliseconds: 30000 };

/** Resolves once the style, sources and every visible tile are painted for the current camera (or once cancelled). */
function whenPainted(map: maplibregl.Map, isCancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (isCancelled() || (map.loaded() && map.areTilesLoaded() && !map.isMoving())) resolve();
      else map.once("render", check);
    };
    map.once("render", check);
    map.triggerRepaint();
  });
}

/** A delayRender handle that can be released from several places, but only once. */
function holdRender(label: string): () => void {
  const handle = delayRender(label, TIMEOUT);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    continueRender(handle);
  };
}

export function lightBounds(points: { lng: number; lat: number }[]): maplibregl.LngLatBoundsLike {
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

type Options = {
  container: RefObject<HTMLDivElement | null>;
  frame: number;
  /** Fit target for the wide shot, computed once from the live map. */
  bounds: maplibregl.LngLatBoundsLike;
  padding: maplibregl.PaddingOptions;
  /** Camera for this frame given the wide-shot camera. */
  cameraAt: (frame: number, wide: Camera) => Camera;
  /** Screen points to project after the camera moved. */
  locations: { lng: number; lat: number }[];
};

/**
 * A MapLibre map driven frame by frame: every frame jumps the camera, then holds the render
 * (delayRender) until all tiles are painted. Times out after 30 s instead of shipping grey frames.
 */
export function useMap({ container, frame, bounds, padding, cameraAt, locations }: Options) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const wideRef = useRef<Camera | null>(null);
  const [ready, setReady] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const optionsRef = useRef({ bounds, padding, cameraAt, locations });
  optionsRef.current = { bounds, padding, cameraAt, locations };

  // Held from the map's creation until the first frame is painted (released by the per-frame effect).
  const releaseLoad = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    const release = holdRender("Creando el mapa");
    releaseLoad.current = release;
    const el = container.current!;
    const map = new maplibregl.Map({
      container: el,
      style: spanishLabels(buildMapStyle("dark") as unknown as maplibregl.StyleSpecification),
      center: [0, 0],
      zoom: 1,
      interactive: false,
      fadeDuration: 0,
      attributionControl: false,
      pixelRatio: 1,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapRef.current = map;
    map.on("error", (e) => cancelRender(new Error(`Map error: ${(e as unknown as { error?: Error }).error?.message ?? e.type}`)));
    map.once("load", () => {
      if (cancelled) return;
      const cam = map.cameraForBounds(optionsRef.current.bounds, { padding: optionsRef.current.padding });
      if (!cam || !cam.center) {
        cancelRender(new Error("No se pudo encuadrar Europa"));
        return;
      }
      const c = maplibregl.LngLat.convert(cam.center as maplibregl.LngLatLike);
      wideRef.current = { lng: c.lng, lat: c.lat, zoom: cam.zoom ?? 4 };
      setReady(true);
    });
    return () => {
      cancelled = true;
      release();
      releaseLoad.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [container]);

  // Layout effect: its delayRender exists at commit, before Remotion's rAF check.
  useLayoutEffect(() => {
    const map = mapRef.current;
    const wide = wideRef.current;
    if (!ready || !map || !wide) return;
    let cancelled = false;
    const release = holdRender(`Mapa, cuadro ${frame}`);
    const o = optionsRef.current;
    const cam = o.cameraAt(frame, wide);
    map.jumpTo({ center: [cam.lng, cam.lat], zoom: cam.zoom });
    setPoints(o.locations.map((l) => {
      const p = map.project([l.lng, l.lat]);
      return { x: p.x, y: p.y };
    }));
    whenPainted(map, () => cancelled).then(
      () => {
        if (cancelled) return;
        release();
        releaseLoad.current?.();
      },
      (e) => cancelRender(e),
    );
    return () => {
      cancelled = true;
      release();
    };
  }, [ready, frame]);

  return { points, ready };
}

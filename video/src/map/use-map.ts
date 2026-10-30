import * as maplibregl from "maplibre-gl";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { buildMapStyle } from "../../../src/features/map/style";

export type Camera = { lng: number; lat: number; zoom: number };
export type Point = { x: number; y: number };

// Webpack emits the worker as an asset; MapLibre loads it by URL.
maplibregl.setWorkerUrl(new URL("../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

const TIMEOUT = { timeoutInMilliseconds: 30000 };

/** Resolves once the style, sources and every visible tile are painted for the current camera. */
function whenPainted(map: maplibregl.Map): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (map.loaded() && map.areTilesLoaded() && !map.isMoving()) resolve();
      else map.once("render", check);
    };
    map.once("render", check);
    map.triggerRepaint();
  });
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

  useLayoutEffect(() => {
    const handle = delayRender("Creando el mapa", TIMEOUT);
    const el = container.current!;
    const map = new maplibregl.Map({
      container: el,
      style: buildMapStyle("dark") as unknown as maplibregl.StyleSpecification,
      center: [0, 0],
      zoom: 1,
      interactive: false,
      fadeDuration: 0,
      attributionControl: false,
      pixelRatio: 1,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapRef.current = map;
    map.on("error", (e) => cancelRender(new Error("MAPDBG " + String((e as unknown as { error?: Error }).error?.message))));
    map.once("load", () => {
      const cam = map.cameraForBounds(optionsRef.current.bounds, { padding: optionsRef.current.padding });
      if (!cam || !cam.center) {
        cancelRender(new Error("No se pudo encuadrar Europa"));
        return;
      }
      const c = maplibregl.LngLat.convert(cam.center as maplibregl.LngLatLike);
      wideRef.current = { lng: c.lng, lat: c.lat, zoom: cam.zoom ?? 4 };
      setReady(true);
      continueRender(handle);
    });
    map.on("error", (e) => console.warn("map error", (e as unknown as { error?: Error }).error?.message));
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [container]);

  useEffect(() => {
    const map = mapRef.current;
    const wide = wideRef.current;
    if (!ready || !map || !wide) return;
    const handle = delayRender(`Mapa, cuadro ${frame}`, TIMEOUT);
    const o = optionsRef.current;
    const cam = o.cameraAt(frame, wide);
    map.jumpTo({ center: [cam.lng, cam.lat], zoom: cam.zoom });
    setPoints(o.locations.map((l) => {
      const p = map.project([l.lng, l.lat]);
      return { x: p.x, y: p.y };
    }));
    whenPainted(map).then(() => continueRender(handle), (e) => cancelRender(e));
  }, [ready, frame]);

  return { points, ready };
}

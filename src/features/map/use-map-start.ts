import type { InitialViewState } from "@maplibre/maplibre-react-native";
import { useEffect, useRef, useState } from "react";
import { boundsOf, type toFeatures } from "@/features/map/features";
import { isTripActive, startView, startZoom, WORLD_VIEW } from "@/features/map/framing";
import { knownPosition } from "@/features/map/use-user-location";

/** How long the map may stay hidden waiting for the location before it starts with what it has. */
const START_TIMEOUT_MS = 1500;

type Features = ReturnType<typeof toFeatures>["features"];
type Padding = { top: number; right: number; bottom: number; left: number };

/**
 * Where the map's camera starts, decided before the map is mounted so no other place flashes first
 * (`start` is null until then), and the late framing when the data arrives after the map started.
 * `framed` and `zoomRef` are shared with the map: other framing (a focused photo) marks `framed`, and the
 * map reports its zoom through `zoomRef`.
 */
export function useMapStart(input: {
  detail: { trip: { startsAt: number; endsAt: number } } | null;
  error: unknown;
  hasFeed: boolean;
  all: { features: Features };
  padding: Padding;
  hasLocation: boolean | null;
  mapReady: boolean;
  centerOnUser: (ask: boolean) => Promise<boolean>;
  frameAll: (features: Features, duration: number) => void;
}) {
  const { detail, error, hasFeed, all, padding, hasLocation, mapReady, centerOnUser, frameAll } = input;
  const [start, setStart] = useState<InitialViewState | null>(null);
  const startDecided = useRef(false);
  const deciding = useRef(false);
  const framed = useRef(false);
  const zoomRef = useRef(WORLD_VIEW.zoom);

  function begin(view: InitialViewState) {
    zoomRef.current = startZoom(view);
    setStart(view);
  }

  // Where the map starts (see `startView`), decided before mounting it. Waits to know the permission
  // and to have data; the location is only read if permission was already granted (it never asks here).
  const tripKnown = !!detail || !!error;
  const dataReady = hasLocation !== null && tripKnown && (hasFeed || !!error);
  useEffect(() => {
    if (startDecided.current || deciding.current || !dataReady) return;
    deciding.current = true;
    const active = detail ? isTripActive(detail.trip, Date.now()) : false;
    const bounds = boundsOf(all.features);
    void (async () => {
      const position = hasLocation && (active || !bounds) ? await knownPosition(active) : null;
      if (startDecided.current) return; // the timeout already started the map
      startDecided.current = true;
      framed.current = true;
      begin(startView({ active, position, bounds, padding }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, detail, hasLocation, all, padding]);

  // A slow location lookup (or slow data) can't keep the map hidden: after a moment it starts with the
  // pins it has, or the world. If the data wasn't there yet, the effect below frames it when it arrives.
  const latest = useRef({ all, padding, dataReady });
  latest.current = { all, padding, dataReady };
  useEffect(() => {
    const timer = setTimeout(() => {
      if (startDecided.current) return;
      startDecided.current = true;
      const { all: now, padding: pad, dataReady: ready } = latest.current;
      framed.current = ready;
      begin(startView({ active: false, position: null, bounds: boundsOf(now.features), padding: pad }));
    }, START_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  // Only when the map started before having data: frame it once it arrives, as the starting view would.
  useEffect(() => {
    if (!mapReady || framed.current || !dataReady) return;
    framed.current = true;
    const active = detail ? isTripActive(detail.trip, Date.now()) : false;
    void (async () => {
      if (active && hasLocation && (await centerOnUser(false))) return;
      frameAll(all.features, 0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, dataReady, all, detail, hasLocation]);

  return { start, framed, zoomRef };
}

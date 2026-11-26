// Builds the poster of a roll: stops, place names, the map image and the photos on the pins, painted into a JPEG in the cache.
// Privacy: only `filmCandidates` photos, only the share cut's stops (cell centres); never a photo's own coordinates or an author's avatar.
import * as Network from "expo-network";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { localDay } from "@/features/capture/quota";
import type { RevealedPhoto } from "@/features/media/revealed";
import { fileId } from "@/features/share/file-id";
import { writeShareFile } from "@/features/share/share-story";
import type { TripDetail } from "@/features/trips/actions";
import { filmCandidates, toFilmPhoto } from "../film-photos";
import { loadPhotos, loadPosterMap } from "../engine/assets";
import { geocodeStops, stopLabels } from "../places";
import { buildStops, FILM_CUTS, routeKm, type FilmPhoto } from "../route";
import { posterDates, posterLayout, posterStats, POSTER_SCALE } from "./poster-layout";
import { renderPoster } from "./render-poster";

export type Poster =
  | { status: "loading" }
  | { status: "error"; offline: boolean; retry: () => void }
  | { status: "no-route" }
  | { status: "ready"; uri: string; version: string };

const DAY = 24 * 60 * 60 * 1000;
const LOADING: Poster = { status: "loading" };

async function isOffline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return !state.isConnected;
  } catch {
    return false;
  }
}

/**
 * `photos`: the photos the Recorrido uses (already chosen). `enabled` must only be true for a roll where `filmBlocked(...)`
 * is null (the screen decides); the hook itself only ever uses `filmCandidates(photos)`.
 */
export function usePoster(args: { tripId: string; photos: RevealedPhoto[]; token: string | null; detail: TripDetail; enabled: boolean }): Poster {
  const { tripId, photos, token, detail, enabled } = args;
  const [poster, setPoster] = useState<Poster>(LOADING);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const filmPhotos = useMemo(() => {
    if (!token) return [];
    const out: FilmPhoto[] = [];
    for (const p of filmCandidates(photos)) {
      const mapped = toFilmPhoto(p, token);
      if (mapped) out.push(mapped);
    }
    return out;
  }, [photos, token]);

  // The effect is keyed by `version`, not by the array's identity: a caller that rebuilds `photos` every render must not restart it.
  const latest = useRef(filmPhotos);
  latest.current = filmPhotos;
  const { name, startsAt, endsAt, timezone } = detail.trip;
  const version = useMemo(
    () => `${tripId}:${fileId(filmPhotos.map((p) => p.id).sort().join(","))}:${fileId(`${name}|${startsAt}|${endsAt}|${timezone}`)}`,
    [tripId, filmPhotos, name, startsAt, endsAt, timezone],
  );

  useEffect(() => {
    // No token yet (it is on its way): stay loading and request nothing until it arrives.
    if (!enabled || !token) {
      setPoster(LOADING);
      return;
    }
    let live = true;
    const set = (next: Poster) => {
      if (live) setPoster(next);
    };
    set(LOADING);

    void (async () => {
      try {
        const used = latest.current;
        const firstDay = localDay(startsAt, timezone);
        const stops = buildStops(used, FILM_CUTS.share, firstDay);
        if (stops.length < 2) {
          set({ status: "no-route" });
          return;
        }
        const geocoded = await geocodeStops(stops, 5000);
        if (!live) return;
        const places = stopLabels(geocoded, true, geocoded.map((g) => g.spot));
        const layout = posterLayout(stops, places, FILM_CUTS.share);
        const map = await loadPosterMap(layout.map, POSTER_SCALE);
        if (!live) return;
        const loaded = await loadPhotos(stops.map((s) => ({ id: s.shots[0]!.id, image: s.shots[0]!.thumb })));
        if (!live) return;
        const days = Math.round((Date.parse(localDay(endsAt, timezone)) - Date.parse(firstDay)) / DAY) + 1;
        const bytes = renderPoster({
          name,
          dates: posterDates(startsAt, endsAt, timezone),
          stats: posterStats({ days, km: routeKm(stops), stops: stops.length }),
          layout,
          map,
          photos: loaded,
        });
        const uri = await writeShareFile(bytes, `rollo-afiche-${fileId(version)}.jpg`);
        set({ status: "ready", uri, version });
      } catch {
        const offline = await isOffline();
        set({ status: "error", offline, retry });
      }
    })();

    return () => {
      live = false;
    };
  }, [enabled, token, name, startsAt, endsAt, timezone, version, attempt, retry]);

  // After a photo or trip change the old result is for another version until the effect runs: never hand it out.
  if (poster.status === "ready" && poster.version !== version) return LOADING;
  return poster;
}

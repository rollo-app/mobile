// Builds the whole film of a roll: stops, place names, scene and images. Not the playing of it.
import * as Network from "expo-network";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { localDay } from "@/features/capture/quota";
import { memberColor } from "@/features/map/member-color";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";
import { avatarUri } from "@/features/profile/avatar-style";
import { fileId } from "@/features/share/file-id";
import type { TripDetail } from "@/features/trips/actions";
import type { AnyFilm } from "./any-film";
import { filmCandidates } from "./film-photos";
import { incomplete, layoutTexts, loadLayers, loadPhotos } from "./engine/assets";
import type { Assets } from "./engine/draw";
import { buildScene, sceneInput } from "./engine/scene";
import type { Scene } from "./engine/model";
import { geocodeStops, stopLabels } from "./places";
import { buildStops, FILM_CUTS, FILM_FRAME, routeKm, type FilmPhoto, type ImageRef, type Stop } from "./route";

export type Film =
  | { status: "loading"; done: number; total: number }
  | { status: "error"; offline: boolean; retry: () => void }
  | { status: "no-route" }
  | { status: "ready"; film: AnyFilm; stops: Stop[]; photos: FilmPhoto[] };

const DAY = 24 * 60 * 60 * 1000;

function toFilmPhoto(p: RevealedPhoto, token: string): FilmPhoto | null {
  if (p.lat === null || p.lng === null) return null;
  const avatar = avatarUri(p.author.avatarUrl);
  return {
    id: p.id,
    authorId: p.author.id,
    authorName: p.author.name,
    authorAvatar: avatar ? { uri: avatar } : null,
    lat: p.lat,
    lng: p.lng,
    takenAt: p.takenAt,
    day: p.day,
    likeCount: p.likeCount,
    thumb: mediaSource(p.thumbPath, token),
    display: mediaSource(p.displayPath, token),
  };
}

async function isOffline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return !state.isConnected;
  } catch {
    return false;
  }
}

const LOADING: Film = { status: "loading", done: 0, total: 0 };

/**
 * `version` changes with the trip, the photo set and the seed: an exported file belongs to one version.
 * `enabled` must only be true for a roll where `filmBlocked(...)` is null (the screen decides); the hook itself only ever
 * uses `filmCandidates(photos)`.
 */
export function useFilm(args: { tripId: string; photos: RevealedPhoto[]; token: string | null; detail: TripDetail; seed: number; enabled: boolean }): Film {
  const { tripId, photos, token, detail, seed, enabled } = args;
  const [film, setFilm] = useState<Film>(LOADING);
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

  // The effect is keyed by `version`, not by the array's identity: a caller that rebuilds `photos` every render must not restart the film.
  const latest = useRef(filmPhotos);
  latest.current = filmPhotos;
  const version = useMemo(() => `${tripId}:${seed}:${fileId(filmPhotos.map((p) => p.id).sort().join(","))}`, [tripId, seed, filmPhotos]);
  const { name, startsAt, endsAt, timezone } = detail.trip;
  const totalUploaded = detail.totalUploaded;

  useEffect(() => {
    // No token yet (it is on its way): stay loading and request nothing until it arrives.
    if (!enabled || !token) {
      setFilm(LOADING);
      return;
    }
    let live = true;
    const set = (next: Film) => {
      if (live) setFilm(next);
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
        const places = stopLabels(geocoded, FILM_CUTS.share.cityTitles, geocoded.map((g) => g.spot));
        const days = Math.round((Date.parse(localDay(endsAt, timezone)) - Date.parse(firstDay)) / DAY) + 1;
        const scene = buildScene(
          sceneInput({ name, stops, places, cut: FILM_CUTS.share, seed, days, km: routeKm(stops), photos: totalUploaded, colorOf: memberColor }),
        );

        const images: { id: string; image: ImageRef }[] = [];
        const avatars = new Set<string>();
        for (const stop of stops) {
          for (const shot of stop.shots) {
            images.push({ id: shot.id, image: shot.thumb });
            if (shot.authorAvatar && !avatars.has(shot.authorId)) {
              avatars.add(shot.authorId);
              images.push({ id: `avatar:${shot.authorId}`, image: shot.authorAvatar });
            }
          }
        }
        const total = scene.layers.length + images.length;
        set({ status: "loading", done: 0, total });
        const layers = await loadLayers(scene.layers, (done) => set({ status: "loading", done, total }));
        if (!live) return;
        const loaded = await loadPhotos(images);
        if (!live) return;
        const assets: Assets = { layers, photos: loaded, texts: layoutTexts(scene.texts, FILM_FRAME) };
        if (incomplete(assets)) throw new Error("incomplete film assets");
        set({
          status: "ready",
          film: { kind: "route", scene, assets, durationMs: scene.durationMs, restAt: scene.input.timeline.doneAt, version },
          stops,
          photos: used,
        });
      } catch {
        const offline = await isOffline();
        set({ status: "error", offline, retry });
      }
    })();

    return () => {
      live = false;
    };
  }, [enabled, token, name, startsAt, endsAt, timezone, totalUploaded, seed, version, attempt, retry]);

  // After a seed or photo change the old result is for another version until the effect runs: never hand it out.
  if (film.status === "ready" && film.film.version !== version) return LOADING;
  return film;
}

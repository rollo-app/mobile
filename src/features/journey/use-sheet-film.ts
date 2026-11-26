// Builds the contact-sheet film of a roll: input, photos, avatars and text layout. Not the playing of it.
import * as Network from "expo-network";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { memberColor } from "@/features/map/member-color";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";
import { avatarUri } from "@/features/profile/avatar-style";
import { dateRange } from "@/features/share/collage";
import { fileId } from "@/features/share/file-id";
import type { TripDetail } from "@/features/trips/actions";
import { memberTotal } from "@/features/trips/member-total";
import type { AnyFilm } from "./any-film";
import { layoutTexts, loadPhotos } from "./engine/assets";
import { FILM_FRAME, type ImageRef } from "./route";
import { localClocks } from "./sheet/local-time";
import { SHEET_MIN } from "./sheet/sheet-photos";
import { buildSheetScene, type SheetCellInput } from "./sheet/sheet-scene";

export type SheetFilm =
  | { status: "loading"; done: number; total: number }
  | { status: "error"; offline: boolean; retry: () => void }
  | { status: "few" }
  | { status: "ready"; film: AnyFilm; photos: RevealedPhoto[] };

const LOADING: SheetFilm = { status: "loading", done: 0, total: 0 };

async function isOffline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return !state.isConnected;
  } catch {
    return false;
  }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function cellInputs(cells: RevealedPhoto[], timeZone: string): SheetCellInput[] {
  const clocks = localClocks(cells.map((p) => p.takenAt), timeZone);
  return cells.map((p, i) => {
    const name = p.author.name.trim();
    const initial = name ? (String.fromCodePoint(name.codePointAt(0)!).toUpperCase()) : "?";
    return {
      id: p.id,
      takenAt: p.takenAt,
      localMinutes: clocks[i]!.localMinutes,
      day: clocks[i]!.day,
      author: { initial, color: memberColor(p.author.id), avatar: avatarUri(p.author.avatarUrl) ? `avatar:${p.author.id}` : null },
    };
  });
}

/**
 * `version` changes with the trip, the seed, the cells and the highlights: an exported file belongs to one version.
 * Fewer than `SHEET_MIN` cells is `few`; the screen decides when the hook is `enabled`.
 */
export function useSheetFilm(args: {
  tripId: string;
  cells: RevealedPhoto[];
  highlights: string[];
  token: string | null;
  detail: TripDetail;
  seed: number;
  enabled: boolean;
}): SheetFilm {
  const { tripId, cells, highlights, token, detail, seed, enabled } = args;
  const [film, setFilm] = useState<SheetFilm>(LOADING);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // The effect is keyed by `version`, not by the arrays' identity: a caller that rebuilds them every render must not restart the film.
  const latest = useRef({ cells, highlights });
  latest.current = { cells, highlights };
  const version = useMemo(
    () => `${tripId}:${seed}:${fileId(cells.map((p) => p.id).join(","))}:${fileId([...highlights].sort().join(","))}`,
    [tripId, seed, cells, highlights],
  );
  const { name, startsAt, endsAt, timezone } = detail.trip;
  const totalUploaded = detail.totalUploaded;
  const people = memberTotal(detail);
  const few = cells.length < SHEET_MIN;

  useEffect(() => {
    // No token yet (it is on its way): stay loading and request nothing until it arrives.
    if (!enabled || !token || few) {
      setFilm(LOADING);
      return;
    }
    let live = true;
    const set = (next: SheetFilm) => {
      if (live) setFilm(next);
    };
    set(LOADING);

    void (async () => {
      try {
        const used = latest.current.cells;
        const scene = buildSheetScene({
          frame: FILM_FRAME,
          seed,
          name,
          dateLine: dateRange(startsAt, endsAt, timezone),
          closingLine: `${plural(totalUploaded, "foto", "fotos")} · ${plural(people, "persona", "personas")}`,
          cells: cellInputs(used, timezone),
          highlights: latest.current.highlights,
        });
        const byId = new Map(used.map((p) => [p.id, p]));
        const images: { id: string; image: ImageRef }[] = [];
        const avatars = new Set<string>();
        for (const cell of scene.cells) {
          const p = byId.get(cell.id);
          if (!p) continue;
          images.push({ id: p.id, image: mediaSource(p.thumbPath, token) });
          const avatar = avatarUri(p.author.avatarUrl);
          if (avatar && !avatars.has(p.author.id)) {
            avatars.add(p.author.id);
            images.push({ id: `avatar:${p.author.id}`, image: { uri: avatar } });
          }
        }
        const total = images.length;
        set({ status: "loading", done: 0, total });
        const loaded = await loadPhotos(images);
        if (!live) return;
        const assets = { photos: loaded, texts: layoutTexts(scene.texts, FILM_FRAME) };
        const shown = scene.cells.flatMap((c) => byId.get(c.id) ?? []);
        set({
          status: "ready",
          film: { kind: "sheet", scene, assets, durationMs: scene.durationMs, restAt: scene.t.doneAt, version },
          photos: shown,
        });
      } catch {
        const offline = await isOffline();
        set({ status: "error", offline, retry });
      }
    })();

    return () => {
      live = false;
    };
  }, [enabled, token, few, name, startsAt, endsAt, timezone, totalUploaded, people, seed, version, attempt, retry]);

  if (enabled && few) return { status: "few" };
  // After a change the old result is for another version until the effect runs: never hand it out.
  if (film.status === "ready" && film.film.version !== version) return LOADING;
  return film;
}

// Which videos a roll has ("Recorrido", "Resumen"). One decision for the share screen and the gallery's banner. Pure.
import { filmBlocked, filmCandidates, filmStopCount } from "@/features/journey/film-photos";
import { SHEET_MAX, sheetBlocked, sheetCandidates } from "@/features/journey/sheet/sheet-photos";
import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";

export type RollVideoKind = "route" | "sheet";

/** What the two conditions below look at in a roll's photos. */
export type RollVideoCounts = { poolStops: number; sheetOffered: number };

/** Stops the route film would have and photos the summary film would be offered, from every revealed photo. `firstDay` is the roll's first local day. */
export function rollVideoCounts(photos: RevealedPhoto[], firstDay: string | null): RollVideoCounts {
  return {
    poolStops: firstDay === null ? 0 : filmStopCount(filmCandidates(photos), firstDay),
    // Offered from the candidates alone: taking photos out of the summary (even below the minimum) must not remove the way back to the picker.
    sheetOffered: Math.min(sheetCandidates(photos).length, SHEET_MAX),
  };
}

/** Whether the roll has a poster: the Recorrido's own conditions, with no video module needed. */
export function rollHasPoster(input: { detail: TripDetail | null; ready: boolean; feedFailed: boolean; poolStops: number }): boolean {
  const { detail, ready, feedFailed, poolStops } = input;
  return ready && !feedFailed && detail !== null && filmBlocked(detail, poolStops) === null;
}

/**
 * The videos this roll has, route first. `ready`: the roll's whole feed is in (or its loading was tried); `feedFailed`: it could not be loaded.
 * `videoAvailable` is false in a build without the video module.
 */
export function rollVideos(input: {
  detail: TripDetail | null;
  videoAvailable: boolean;
  ready: boolean;
  feedFailed: boolean;
} & RollVideoCounts): RollVideoKind[] {
  const { detail, videoAvailable, ready, feedFailed, poolStops, sheetOffered } = input;
  if (!videoAvailable || !ready || feedFailed || detail === null) return [];
  const kinds: RollVideoKind[] = [];
  if (filmBlocked(detail, poolStops) === null) kinds.push("route");
  if (sheetBlocked(detail, sheetOffered) === null) kinds.push("sheet");
  return kinds;
}

/** The roll's most liked live photo (the earlier one on a tie), or null. */
export function bannerPhoto(photos: RevealedPhoto[]): RevealedPhoto | null {
  let best: RevealedPhoto | null = null;
  for (const p of photos) {
    if (p.type !== "photo" || p.archived) continue;
    if (best === null || p.likeCount > best.likeCount) best = p;
  }
  return best;
}

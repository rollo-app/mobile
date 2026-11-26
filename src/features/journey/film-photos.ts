// Which photos of a roll may go in a shared film, and whether the roll has a film at all. Pure.
import { isEvent } from "@/features/events/event";
import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { buildStops, FILM_CUTS, type FilmPhoto } from "./route";

export const FILM_MAX = 15;

/** Photos that may leave the roll in a film: shareable, a photo, with coordinates, not archived. */
export function filmCandidates(photos: RevealedPhoto[]): RevealedPhoto[] {
  return photos.filter((p) => p.shareable && p.type === "photo" && p.lat !== null && p.lng !== null && !p.archived);
}

/** The chosen candidates (any order), or every candidate when the selection has none usable. */
export function filmPhotos(candidates: RevealedPhoto[], selection: readonly string[]): RevealedPhoto[] {
  const chosen = new Set(selection);
  const picked = candidates.filter((p) => chosen.has(p.id));
  return picked.length > 0 ? picked : candidates;
}

/** Why this roll has no film to share, or null. */
export function filmBlocked(detail: TripDetail, stops: number): "event" | "private" | "unrevealed" | "no-route" | null {
  if (isEvent(detail.trip)) return "event";
  if (detail.trip.featuringDisabled) return "private";
  if (!detail.trip.revealed) return "unrevealed";
  if (stops < 2) return "no-route";
  return null;
}

/** How many stops the share cut gives these candidates: no geocoding, no images (the stops only look at where, who and when). */
export function filmStopCount(candidates: RevealedPhoto[], firstDay: string): number {
  const photos: FilmPhoto[] = [];
  for (const p of candidates) {
    if (p.lat === null || p.lng === null) continue;
    const image = { uri: "" };
    photos.push({
      id: p.id,
      authorId: p.author.id,
      authorName: p.author.name,
      authorAvatar: null,
      lat: p.lat,
      lng: p.lng,
      takenAt: p.takenAt,
      day: p.day,
      likeCount: p.likeCount,
      thumb: image,
      display: image,
    });
  }
  return buildStops(photos, FILM_CUTS.share, firstDay).length;
}

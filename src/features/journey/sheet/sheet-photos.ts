// Which photos of a roll go in the contact-sheet film and in which state. Pure.
// Likes only CHOOSE the photos; what is returned is always in time order, so the film never shows or implies who got more votes.
import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";

export const SHEET_MAX = 30;
export const HIGHLIGHT_MAX = 12;
export const SHEET_MIN = 6;

export type SheetState = "sheet" | "highlight" | "out";
/** What the person changed by hand: photo id → state. A photo not listed follows the automatic pick. */
export type SheetChoices = Readonly<Record<string, SheetState>>;

/** Photos that may appear in the film: shareable, a photo, not archived (no coordinates needed). */
export function sheetCandidates(photos: RevealedPhoto[]): RevealedPhoto[] {
  return photos.filter((p) => p.shareable && p.type === "photo" && !p.archived);
}

type Ranked = { photo: RevealedPhoto; index: number };

const byTime = (a: Ranked, b: Ranked) => a.photo.takenAt - b.photo.takenAt || a.index - b.index;
const byLikes = (a: Ranked, b: Ranked) => b.photo.likeCount - a.photo.likeCount || byTime(a, b);

/** The state every candidate ends up in, by id. */
export function sheetStates(candidates: RevealedPhoto[], choices: SheetChoices): Record<string, SheetState> {
  const states: Record<string, SheetState> = {};
  const ranked: Ranked[] = candidates.map((photo, index) => ({ photo, index }));
  for (const { photo } of ranked) states[photo.id] = "out";

  // Hand-made choices: sheet/highlight go in first (earliest kept), out stays out.
  const hand = ranked.filter((r) => {
    const choice = choices[r.photo.id];
    return choice === "sheet" || choice === "highlight";
  });
  // Beyond the sheet's size the hand highlights are kept first, then the earliest; the result is still in time order.
  const isHighlight = (r: Ranked) => (choices[r.photo.id] === "highlight" ? 1 : 0);
  const handKept =
    hand.length > SHEET_MAX
      ? [...hand].sort((a, b) => isHighlight(b) - isHighlight(a) || byTime(a, b)).slice(0, SHEET_MAX).sort(byTime)
      : [...hand].sort(byTime);
  const handHighlights = handKept.filter((r) => choices[r.photo.id] === "highlight");
  const handHighlightIds = new Set(handHighlights.slice(0, HIGHLIGHT_MAX).map((r) => r.photo.id));
  for (const { photo } of handKept) states[photo.id] = handHighlightIds.has(photo.id) ? "highlight" : "sheet";

  // The automatic sheet fills what is left, most liked first.
  const free = ranked.filter((r) => choices[r.photo.id] === undefined);
  for (const { photo } of [...free].sort(byLikes).slice(0, Math.max(0, SHEET_MAX - handKept.length))) states[photo.id] = "sheet";

  // The automatic highlights are only a starting point: they exist while no candidate has any choice. The first edit turns them into choices.
  if (ranked.every((r) => choices[r.photo.id] === undefined)) {
    const onSheet = ranked.filter((r) => states[r.photo.id] === "sheet");
    for (const { photo } of [...onSheet].sort(byLikes).slice(0, HIGHLIGHT_MAX)) states[photo.id] = "highlight";
  }
  return states;
}

/** The photos of the sheet (time order) and the highlighted ids (time order). */
export function sheetPick(candidates: RevealedPhoto[], choices: SheetChoices): { cells: RevealedPhoto[]; highlights: string[] } {
  const states = sheetStates(candidates, choices);
  const cells = candidates
    .map((photo, index) => ({ photo, index }))
    .filter((r) => states[r.photo.id] !== "out")
    .sort(byTime)
    .map((r) => r.photo);
  return { cells, highlights: cells.filter((p) => states[p.id] === "highlight").map((p) => p.id) };
}

/** The next state on a tap: sheet → highlight → out → sheet. A 13th highlight is skipped (sheet → out). */
export function nextState(current: SheetState, highlighted: number): SheetState {
  if (current === "sheet") return highlighted >= HIGHLIGHT_MAX ? "out" : "highlight";
  if (current === "highlight") return "out";
  return "sheet";
}

/** "8 destacadas · 22 en la hoja" from the two counts (the sheet count is the photos that are not highlighted). */
export function formatSheetCounter(highlighted: number, onSheet: number): string {
  return `${highlighted} ${highlighted === 1 ? "destacada" : "destacadas"} · ${onSheet} en la hoja`;
}

/** The counter of a pick: highlights, and the sheet-only photos (every cell that is not a highlight). */
export function sheetCounter(pick: { cells: RevealedPhoto[]; highlights: string[] }): string {
  return formatSheetCounter(pick.highlights.length, pick.cells.length - pick.highlights.length);
}

/** Why this roll has no summary film, or null. */
export function sheetBlocked(detail: TripDetail, sheetPhotos: number): "private" | "unrevealed" | "few" | null {
  if (detail.trip.featuringDisabled) return "private";
  if (!detail.trip.revealed) return "unrevealed";
  if (sheetPhotos < SHEET_MIN) return "few";
  return null;
}

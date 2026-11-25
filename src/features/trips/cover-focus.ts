/** Which vertical part of the 3:4 cover the Rollos list shows: 0 = top … 1 = bottom, null = the middle. */
export type CoverFocus = number | null | undefined;

const STEP = 0.1;
const round = (n: number) => Math.round(n * 1000) / 1000;

export const clampFocus = (focus: number): number => Math.min(1, Math.max(0, focus));

/** The focus after moving it a tenth up (negative) or down, clamped to 0..1. */
export const stepFocus = (focus: number, direction: 1 | -1): number => round(clampFocus(focus + direction * STEP));

/** expo-image `contentPosition` for a `contentFit="cover"` crop of the cover; the middle without a focus. */
export function coverContentPosition(focus: CoverFocus): { top: `${number}%` } {
  const value = focus == null ? 0.5 : clampFocus(focus);
  return { top: `${Math.round(value * 1000) / 10}%` };
}

/** Height of the band over a photo `photoWidth` wide: the list card's aspect (cardWidth : 180) across the whole width. */
export const bandHeight = (photoWidth: number, cardWidth: number, cardHeight = 180): number => (photoWidth * cardHeight) / cardWidth;

/** Where the band's top sits for a focus, within the photo's free travel (photo height minus band height). */
export function topFromFocus(focus: number, photoHeight: number, band: number): number {
  return clampFocus(focus) * Math.max(0, photoHeight - band);
}

/** The focus for a band top, clamped inside the photo; the middle if the band fills the photo. */
export function focusFromTop(top: number, photoHeight: number, band: number): number {
  const travel = photoHeight - band;
  return travel > 0 ? round(clampFocus(top / travel)) : 0.5;
}

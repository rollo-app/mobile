/** Caps the server enforces on the photo quota. */
export const MAX_DAILY_PHOTOS = 30;
export const MAX_TOTAL_PHOTOS = 200;

const HOUR = 60 * 60 * 1000;

/** The next full hour after `now`. */
export function defaultStart(now: number): number {
  return (Math.floor(now / HOUR) + 1) * HOUR;
}

/** Only the name is checked here: the server validates the dates and answers with the reason. */
export function canCreate(name: string): boolean {
  return name.trim().length > 0;
}

export type StartMode = "now" | "custom";

/** "Now" is taken at submit time (the server tolerates a few minutes in the past); otherwise the chosen date. */
export function effectiveStart(mode: StartMode, chosen: number, now: number): number {
  return mode === "now" ? now : chosen;
}

/** Keeps `end` if it is after `start`; otherwise 72 h after the start. */
export function endAfter(end: number, start: number): number {
  return end > start ? end : start + 72 * HOUR;
}

/** Keeps `reveal` if it is not before `end`; otherwise 12 h after the end. */
export function revealNotBefore(reveal: number, end: number): number {
  return reveal >= end ? reveal : end + 12 * HOUR;
}

export type MomentMode = "off" | "photo" | "photo_selfie";

/** Daily moment window, in minutes from midnight in the rollo's timezone: 9:00 to 23:00. */
export const DEFAULT_MOMENT_WINDOW = { start: 540, end: 1380 };

/** Minutes from local midnight of a date picked in an hour+minute picker. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** A date today whose local time is `minutes` from midnight (what the time pickers show). */
export function dateAtMinutes(minutes: number): Date {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

import type { RevealedPhoto } from "@/features/media/revealed";
import { formatDate } from "@/features/trips/phase";
import { computeCredits, type Award } from "./credits";
import { dayNumber, localDay } from "./local-day";

export type StoryStats = {
  photos: number;
  videos: number;
  people: number;
  days: number;
  /** Who took the most photos; null when it's a single person (nothing to compare). */
  top: { name: string; count: number } | null;
  /** Some day had more than `MAX_STORY_PER_DAY` photos, so the stories show a selection. */
  trimmed: boolean;
};

export type StoryStep =
  | { kind: "day"; day: string; number: number; title: string; date: string; count: number; shown: number; trimmed: boolean }
  | { kind: "photo"; photo: RevealedPhoto }
  | { kind: "credit"; award: Award }
  /** `cast` is the credits' list of names; null when the roll gets no credits (events, blocked list unavailable). */
  | { kind: "outro"; stats: StoryStats; cast: string[] | null };

/** Turns the credits on: the viewer's blocked user ids are left out of every award and of the cast. */
export type StoryCredits = { blockedUserIds: ReadonlySet<string> };

export const PHOTO_MS = 4000;
export const DAY_CARD_MS = 2000;
export const CREDIT_MS = 4500;
export const MAX_VIDEO_MS = 15_000;
/** A day never lasts more than this many stories: past it, a selection of its best moments. */
export const MAX_STORY_PER_DAY = 30;


const byTime = (a: RevealedPhoto, b: RevealedPhoto) => a.takenAt - b.takenAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * At most `max` photos of one day: the day's photos (by time) are split into `max` buckets of equal count and
 * each gives one. Inside a bucket the most liked wins; ties go to an author not picked yet, then the earliest, then the id.
 * Pure and deterministic; the result is chronological. A day that fits is returned as is.
 */
export function pickDayHighlights(photos: RevealedPhoto[], max: number): RevealedPhoto[] {
  const sorted = [...photos].sort(byTime);
  if (sorted.length <= max) return sorted;
  const pickedAuthors = new Set<string>();
  const out: RevealedPhoto[] = [];
  for (let i = 0; i < max; i++) {
    const bucket = sorted.slice(Math.floor((i * sorted.length) / max), Math.floor(((i + 1) * sorted.length) / max));
    let best = bucket[0]!;
    for (const p of bucket.slice(1)) {
      if (p.likeCount !== best.likeCount) {
        if (p.likeCount > best.likeCount) best = p;
        continue;
      }
      const fresh = (x: RevealedPhoto) => !pickedAuthors.has(x.author.id);
      if (fresh(p) !== fresh(best)) {
        if (fresh(p)) best = p;
        continue;
      }
      // Same likes and same freshness: `bucket` is already by time then id, so `best` stays.
    }
    pickedAuthors.add(best.author.id);
    out.push(best);
  }
  return out;
}

/**
 * The presentation sequence: for each day a card followed by its photos in chronological order,
 * then, with `options.credits`, one step per award, and the outro with the numbers (and the cast). Days are cut in the roll's zone. The reveal intro isn't part of
 * it: it's its own screen (`/reveal`) that hands over to the stories.
 */
export function buildStory(photos: RevealedPhoto[], timeZone: string, options?: { credits?: StoryCredits }): StoryStep[] {
  const sorted = [...photos].sort((a, b) => a.takenAt - b.takenAt);
  const byDay = new Map<string, RevealedPhoto[]>();
  for (const p of sorted) {
    const day = localDay(p.takenAt, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), p]);
  }
  const days = [...byDay.keys()].sort();
  const first = days[0] ? dayNumber(days[0]) : 0;

  const steps: StoryStep[] = [];
  let trimmed = false;
  for (const day of days) {
    const all = byDay.get(day)!;
    const list = pickDayHighlights(all, MAX_STORY_PER_DAY);
    const dayTrimmed = list.length < all.length;
    trimmed ||= dayTrimmed;
    const number = dayNumber(day) - first + 1;
    steps.push({
      kind: "day",
      day,
      number,
      title: `Día ${number}`,
      date: formatDate(all[0]!.takenAt, timeZone),
      count: all.length,
      shown: list.length,
      trimmed: dayTrimmed,
    });
    for (const photo of list) steps.push({ kind: "photo", photo });
  }
  const credits = options?.credits ? computeCredits(photos, timeZone, options.credits.blockedUserIds) : null;
  if (credits) for (const award of credits.awards) steps.push({ kind: "credit", award });
  steps.push({ kind: "outro", stats: computeStats(sorted, days.length, trimmed), cast: credits ? credits.cast : null });
  return steps;
}

function computeStats(sorted: RevealedPhoto[], days: number, trimmed: boolean): StoryStats {
  const counts = new Map<string, { name: string; count: number }>();
  let photos = 0;
  let videos = 0;
  for (const p of sorted) {
    const entry = counts.get(p.author.id) ?? { name: p.author.name, count: 0 };
    if (p.type === "video") videos++;
    else {
      photos++;
      entry.count++;
    }
    counts.set(p.author.id, entry);
  }
  // Map keeps insertion order (= who shot first), so a strict > breaks ties in their favour.
  let top: { name: string; count: number } | null = null;
  for (const e of counts.values()) if (!top || e.count > top.count) top = e;
  return { photos, videos, people: counts.size, days, trimmed, top: counts.size > 1 && top && top.count > 0 ? top : null };
}

/** How long a step stays on screen by itself; null = until the user acts. */
export function stepDuration(step: StoryStep): number | null {
  switch (step.kind) {
    case "day":
      return DAY_CARD_MS;
    case "photo":
      return step.photo.type === "video" && step.photo.durationS
        ? Math.min(step.photo.durationS * 1000, MAX_VIDEO_MS)
        : PHOTO_MS;
    case "credit":
      return CREDIT_MS;
    case "outro":
      return null;
  }
}

/**
 * The segmented progress bar for the step at `index`: one segment per photo of its day, `current`
 * being the one on screen (-1 on the day card, before the first). Credits have their own bar: one segment per
 * award. null in the outro.
 */
export function daySegments(steps: StoryStep[], index: number): { count: number; current: number } | null {
  const step = steps[index];
  if (!step || step.kind === "outro") return null;
  if (step.kind === "day") return { count: step.shown, current: -1 };
  if (step.kind === "credit") {
    let count = 0;
    let current = 0;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i]!.kind !== "credit") continue;
      if (i === index) current = count;
      count++;
    }
    return { count, current };
  }
  let start = index;
  while (start > 0 && steps[start - 1]!.kind === "photo") start--;
  let end = index;
  while (steps[end + 1]?.kind === "photo") end++;
  return { count: end - start + 1, current: index - start };
}

/** Where a linear step's progress is after running `elapsedMs` from `from` (0–1), for a step of `durationMs`. */
export function elapsedProgress(from: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, from + elapsedMs / durationMs));
}

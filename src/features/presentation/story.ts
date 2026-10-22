import type { RevealedPhoto } from "@/features/media/revealed";
import { formatDate } from "@/features/trips/phase";
import { DARKROOM_INTRO_MS, USE_DARKROOM_INTRO } from "./intro-flag";

export type StoryStats = {
  photos: number;
  videos: number;
  people: number;
  days: number;
  /** Who took the most photos; null when it's a single person (nothing to compare). */
  top: { name: string; count: number } | null;
};

export type StoryStep =
  | { kind: "intro" }
  | { kind: "day"; day: string; number: number; title: string; date: string; count: number }
  | { kind: "photo"; photo: RevealedPhoto }
  | { kind: "outro"; stats: StoryStats };

export const PHOTO_MS = 4000;
export const DAY_CARD_MS = 2000;
export const MAX_VIDEO_MS = 15_000;
/** The focus-in: ~2.5 s of reveal plus the roll title. */
export const INTRO_MS = USE_DARKROOM_INTRO ? DARKROOM_INTRO_MS : 5500;

const DAY_MS = 86_400_000;
const localDay = (ms: number, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(ms);
const dayNumber = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / DAY_MS;
};

/**
 * The presentation sequence: the intro (the focus-in), then for each day a card followed by its
 * photos in chronological order, and the outro with the numbers. Days are cut in the roll's zone.
 */
export function buildStory(photos: RevealedPhoto[], timeZone: string): StoryStep[] {
  const sorted = [...photos].sort((a, b) => a.takenAt - b.takenAt);
  const byDay = new Map<string, RevealedPhoto[]>();
  for (const p of sorted) {
    const day = localDay(p.takenAt, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), p]);
  }
  const days = [...byDay.keys()].sort();
  const first = days[0] ? dayNumber(days[0]) : 0;

  const steps: StoryStep[] = [{ kind: "intro" }];
  for (const day of days) {
    const list = byDay.get(day)!;
    const number = dayNumber(day) - first + 1;
    steps.push({
      kind: "day",
      day,
      number,
      title: `Día ${number}`,
      date: formatDate(list[0]!.takenAt, timeZone),
      count: list.length,
    });
    for (const photo of list) steps.push({ kind: "photo", photo });
  }
  steps.push({ kind: "outro", stats: computeStats(sorted, days.length) });
  return steps;
}

function computeStats(sorted: RevealedPhoto[], days: number): StoryStats {
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
  return { photos, videos, people: counts.size, days, top: counts.size > 1 && top && top.count > 0 ? top : null };
}

/** How long a step stays on screen by itself; null = until the user acts. */
export function stepDuration(step: StoryStep): number | null {
  switch (step.kind) {
    case "intro":
      return INTRO_MS;
    case "day":
      return DAY_CARD_MS;
    case "photo":
      return step.photo.type === "video" && step.photo.durationS
        ? Math.min(step.photo.durationS * 1000, MAX_VIDEO_MS)
        : PHOTO_MS;
    case "outro":
      return null;
  }
}

/**
 * The segmented progress bar for the step at `index`: one segment per photo of its day, `current`
 * being the one on screen (-1 on the day card, before the first). null in the intro and the outro.
 */
export function daySegments(steps: StoryStep[], index: number): { count: number; current: number } | null {
  const step = steps[index];
  if (!step || step.kind === "intro" || step.kind === "outro") return null;
  if (step.kind === "day") return { count: step.count, current: -1 };
  let start = index;
  while (start > 0 && steps[start - 1]!.kind === "photo") start--;
  let end = index;
  while (steps[end + 1]?.kind === "photo") end++;
  return { count: end - start + 1, current: index - start };
}

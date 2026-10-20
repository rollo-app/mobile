import type { RevealedPhoto } from "@/features/media/revealed";
import type { StoryStep } from "./story";

/** The next `count` photos after `index`: all we preload while a photo is on screen. */
export function upcomingPhotos(steps: StoryStep[], index: number, count = 2): RevealedPhoto[] {
  const out: RevealedPhoto[] = [];
  for (let i = index + 1; i < steps.length && out.length < count; i++) {
    const step = steps[i]!;
    if (step.kind === "photo") out.push(step.photo);
  }
  return out;
}

/** Evenly spread picks, so the focus-in mosaic samples the whole roll and not just its first day. */
export function sampleEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return Array.from({ length: max }, (_, i) => items[Math.floor((i * items.length) / max)]!);
}

import type { RevealedPhoto } from "@/features/media/revealed";
import type { StoryStep } from "./story";

/** The next `count` photos after `index` (a credit counts as its award's photo): all we preload while a photo is on screen. */
export function upcomingPhotos(steps: StoryStep[], index: number, count = 2): RevealedPhoto[] {
  const out: RevealedPhoto[] = [];
  for (let i = index + 1; i < steps.length && out.length < count; i++) {
    const step = steps[i]!;
    if (step.kind === "photo") out.push(step.photo);
    else if (step.kind === "credit") out.push(step.award.photo);
  }
  return out;
}

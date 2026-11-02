export type SceneId = "camera" | "map" | "reveal" | "gallery" | "profile" | "moment";

export const FPS = 30;
export const TRANSITION_FRAMES = 12;
/** Frames at each end of the loop that sit inside the dip to black. */
export const SEAM_FRAMES = 14;
/** The last frames fade to black (0 → 1), the first frames fade back in (1 → 0). */
export const SEAM_OUT_FRAMES = 10;
export const SEAM_IN_FRAMES = 6;

export const SCENES: { id: SceneId; frames: number }[] = [
  { id: "camera", frames: 120 },
  { id: "map", frames: 135 },
  { id: "moment", frames: 150 },
  { id: "reveal", frames: 135 },
  { id: "gallery", frames: 90 },
  { id: "profile", frames: 90 },
];

export function totalFrames(): number {
  const sum = SCENES.reduce((acc, s) => acc + s.frames, 0);
  return sum - TRANSITION_FRAMES * (SCENES.length - 1);
}

export function sceneStart(id: SceneId): number {
  let start = 0;
  for (const scene of SCENES) {
    if (scene.id === id) return start;
    start += scene.frames - TRANSITION_FRAMES;
  }
  throw new Error(`Unknown scene: ${id}`);
}

/** Black overlay opacity at a frame: 1 on both the last and the first frame, so the loop wraps inside black. */
export function seamOpacity(frame: number): number {
  const total = totalFrames();
  const out = total - SEAM_OUT_FRAMES;
  if (frame >= out) return Math.min(1, (frame - out) / (SEAM_OUT_FRAMES - 1));
  if (frame <= SEAM_IN_FRAMES) return Math.max(0, 1 - frame / SEAM_IN_FRAMES);
  return 0;
}

export type SceneId = "camera" | "map" | "reveal" | "gallery" | "profile" | "moment";

export const FPS = 30;
export const TRANSITION_FRAMES = 12;
/** Frames at each end of the loop that sit inside the shutter flash. */
export const SEAM_FRAMES = 14;

export const SCENES: { id: SceneId; frames: number }[] = [
  { id: "camera", frames: 120 },
  { id: "map", frames: 135 },
  { id: "reveal", frames: 135 },
  { id: "gallery", frames: 90 },
  { id: "profile", frames: 90 },
  { id: "moment", frames: 150 },
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
  throw new Error(`Escena desconocida: ${id}`);
}

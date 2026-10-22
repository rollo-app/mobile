/**
 * Spike: which reveal intro plays. `false` brings back the original mosaic (`intro.tsx`).
 */
export const USE_DARKROOM_INTRO = true;

export const DARKROOM_INTRO_MS = 7000;
const MOSAIC_INTRO_MS = 5500;

/** How long the reveal screen plays before moving on to the stories. */
export const REVEAL_INTRO_MS = USE_DARKROOM_INTRO ? DARKROOM_INTRO_MS : MOSAIC_INTRO_MS;

/**
 * The reveal's timeline, in ms from the moment it starts. Shared by `RevealScreen` (when it hands
 * over to the stories) and `DarkroomIntro` (animations and haptics).
 */
export const REVEAL_TIMELINE = {
  /** The photos start coming out of the chemical. */
  developAt: 1200,
  /** The hit: heavy impact, success, shutter, the red light turns white. */
  hitAt: 5000,
  /** "Se reveló · {rollo} · {fecha}" fades in. */
  titleAt: 5400,
  /** How long each photo takes to develop; their starts spread over what's left until the hit. */
  cellMs: 2400,
  /** The whole sequence: then the screen moves on to the stories. */
  totalMs: 7000,
} as const;

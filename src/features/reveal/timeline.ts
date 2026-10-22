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
  /** Waiting this long for the photos, the detail or the token, the screen gives up and goes to the stories. */
  loadingTimeoutMs: 6000,
  /** With Reduce Motion: no development, the photos fade in, the haptic confirms, then they dim under the title. */
  reduced: {
    /** The photos fade in fully over this long. */
    fadeInMs: 800,
    /** The success haptic, once they are in. */
    hapticAt: 800,
    /** The photos dim and the title fades in. */
    dimAt: 1400,
    dimMs: 600,
    /** How much of the photos stays under the title. */
    dimOpacity: 0.25,
  },
} as const;

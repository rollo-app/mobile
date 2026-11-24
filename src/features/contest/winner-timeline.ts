/**
 * The winner reveal's timeline, in ms from the moment it starts (`WinnerRevealScreen`). Tune it here only.
 */
export const WINNER_TIMELINE = {
  /** The photo develops from its ThumbHash (sepia, blurry → sharp) while the haptic grows. */
  developMs: 2400,
  /** The white flash at the end of the development (success haptic + shutter). */
  flashMs: 350,
  /** "Ganó la foto de @…", the avatar and the votes fade in. */
  textDelayMs: 2700,
  /** The confetti starts falling. */
  confettiDelayMs: 2900,
  /** How long the confetti takes to fall. */
  confettiMs: 2400,
  /** "Ver resultados" shows up this long after the text. */
  buttonDelayMs: 300,
  /** With Reduce Motion: no shader, no confetti, everything fades in over this long. */
  reducedFadeMs: 300,
  /** The screen waits this long for the winner's thumb before developing it (so it never flashes the sharp photo first). */
  thumbsCapMs: 2000,
  /** Waiting this long for the contest or the token, a tap or this timeout goes to the results. */
  loadingTimeoutMs: 6000,
} as const;

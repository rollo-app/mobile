/** When each beat of the app intro happens, in ms from mount. */
export type IntroTiming = { playLottie: boolean; firstLineAt: number; secondLineAt: number; buttonAt: number; moves: boolean };

/**
 * The app's first presentation. Full: the logo assembles (~1.35 s), then the two tagline lines (200 ms apart) and
 * the button. With Reduce Motion (or while it's unknown) the logo is still, everything only fades and the button
 * comes sooner.
 */
export function introTiming(reduceMotion: boolean | null): IntroTiming {
  if (reduceMotion !== false) return { playLottie: false, firstLineAt: 0, secondLineAt: 200, buttonAt: 800, moves: false };
  return { playLottie: true, firstLineAt: 1400, secondLineAt: 1600, buttonAt: 2400, moves: true };
}

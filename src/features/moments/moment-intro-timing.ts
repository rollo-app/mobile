/** When each beat of the moment's intro happens, in ms from mount. */
export type MomentIntroTiming = { playLottie: boolean; hapticAt: number; textAt: number; doneAt: number };

/**
 * The intro before the camera. Full: the Lottie plays (the core pops at ~450 ms, the ring closes at ~1370 ms), the text
 * fades in after the pop and the screen ends at 1.7 s. With Reduce Motion (or while it's still unknown) there is no
 * animation: the final frame shows with the text at once, and it ends sooner.
 */
export function momentIntroTiming(reduceMotion: boolean | null): MomentIntroTiming {
  if (reduceMotion !== false) return { playLottie: false, hapticAt: 300, textAt: 0, doneAt: 1200 };
  return { playLottie: true, hapticAt: 450, textAt: 600, doneAt: 1700 };
}

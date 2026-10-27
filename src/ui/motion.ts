import { Easing, ReduceMotion, type WithTimingConfig } from "react-native-reanimated";

/** The app's strong ease-out (entrances and exits): starts fast, settles long. */
export const EASE_OUT_BEZIER = [0.23, 1, 0.32, 1] as const;

/** Built on call, never at module scope: route test suites mock Reanimated as an empty object. */
export function easeOut() {
  return Easing.bezier(...EASE_OUT_BEZIER);
}

/**
 * Timing for motion that already picked its own Reduce Motion variant (fade only, no movement). `ReduceMotion.Never`
 * so Reanimated doesn't also skip it: its default (System) jumps to the end and skips `withDelay`'s delay.
 */
export function ownedTiming(duration: number): WithTimingConfig {
  return { duration, easing: easeOut(), reduceMotion: ReduceMotion.Never };
}

/** What the welcome's logo mark does: wait for what it needs to know, play its intro (first time ever) or sit still. */
export type WelcomeMark = "wait" | "play" | "still";

/**
 * `seen` is whether the intro already ran on this phone (`null` until read); `reduceMotion` is iOS's setting
 * (`null` until known, so the animation never starts and then switches).
 */
export function welcomeMark(seen: boolean | null, reduceMotion: boolean | null): WelcomeMark {
  if (seen === null) return "wait";
  if (seen) return "still";
  if (reduceMotion === null) return "wait";
  return reduceMotion ? "still" : "play";
}

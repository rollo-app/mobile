/** How the sent photo leaves into the roll: it drops and shrinks while it fades. */
export type SendExit = { duration: number; scale: number; translateY: number };

/**
 * The exit of "Mandar al rollo". With Reduce Motion (or while it's still unknown) it only fades:
 * no movement or scale, and a bit shorter.
 */
export function sendExit(reduceMotion: boolean | null): SendExit {
  if (reduceMotion !== false) return { duration: 200, scale: 1, translateY: 0 };
  return { duration: 260, scale: 0.92, translateY: 24 };
}

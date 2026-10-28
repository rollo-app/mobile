/** Drag distance (pt) past which releasing closes the presentation. */
export const DISMISS_DISTANCE = 120;
/** Downward release velocity (pt/ms) that closes it even over a short drag. */
export const DISMISS_VELOCITY = 1;
/** Minimum drag (pt) before a fling counts, so a flick of the finger doesn't close by accident. */
const MIN_FLING_DISTANCE = 30;
/** Movement (pt) before a gesture is decided. */
const CLAIM_SLOP = 10;

/** Whether releasing the drag at `dy` pt with vertical velocity `vy` pt/ms closes the story. */
export function shouldDismiss(dy: number, vy: number): boolean {
  "worklet";
  return dy >= DISMISS_DISTANCE || (dy >= MIN_FLING_DISTANCE && vy >= DISMISS_VELOCITY);
}

/** Whether a move is clearly vertical and downward, the only one that takes over from taps and holds. */
export function isDownwardDrag(dx: number, dy: number): boolean {
  "worklet";
  return dy > CLAIM_SLOP && dy > Math.abs(dx) * 2;
}

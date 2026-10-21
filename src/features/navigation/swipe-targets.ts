/** The tabs that take part in swiping. Mapa pans with the finger and Cámara isn't a screen, so they don't. */
export type SwipeTab = "roll" | "feed" | "me";
export type SwipeDirection = "previous" | "next";

/** A touch that starts this close to the left edge belongs to the iOS interactive back swipe. */
export const EDGE_GUARD = 24;
/** Horizontal distance (pt) that commits a swipe. */
export const SWIPE_DISTANCE = 60;
/** A flick this fast (pt/ms) commits from {@link FLICK_DISTANCE}. */
const FLICK_VELOCITY = 0.5;
const FLICK_DISTANCE = 30;
/** Movement (pt) before a drag is claimed as horizontal. */
const CLAIM_DISTANCE = 10;
/** The drag must be this many times longer horizontally than vertically. */
const DOMINANCE = 1.5;

/** Swipeable tabs currently visible, in bar order. */
export function swipeTabs({ feedHidden }: { feedHidden: boolean }): SwipeTab[] {
  return feedHidden ? ["roll", "me"] : ["roll", "feed", "me"];
}

/** The neighbor in that direction, or `null` at the ends (or if the current tab isn't visible). */
export function swipeTarget(visible: readonly SwipeTab[], current: SwipeTab, direction: SwipeDirection): SwipeTab | null {
  const index = visible.indexOf(current);
  if (index === -1) return null;
  return visible[direction === "previous" ? index - 1 : index + 1] ?? null;
}

export function swipeHref(tab: SwipeTab): "/roll" | "/feed" | "/me" {
  return `/${tab}`;
}

const isDominant = (dx: number, dy: number) => Math.abs(dx) > DOMINANCE * Math.abs(dy);

/** Whether a move in progress should be claimed by the swipe (so it doesn't fight vertical scrolling or the back swipe). */
export function isHorizontalDrag({ dx, dy, startX }: { dx: number; dy: number; startX: number }): boolean {
  return startX >= EDGE_GUARD && Math.abs(dx) >= CLAIM_DISTANCE && isDominant(dx, dy);
}

/** What a finished drag means: left to right goes to the previous tab, right to left to the next. */
export function resolveSwipe({ dx, dy, vx }: { dx: number; dy: number; vx: number }): SwipeDirection | null {
  if (!isDominant(dx, dy)) return null;
  const far = Math.abs(dx) >= SWIPE_DISTANCE;
  const flick = Math.abs(dx) >= FLICK_DISTANCE && Math.abs(vx) >= FLICK_VELOCITY;
  if (!far && !flick) return null;
  return dx > 0 ? "previous" : "next";
}

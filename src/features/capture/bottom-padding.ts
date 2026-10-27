/**
 * Bottom padding of the caption screen for a given keyboard height. Resting: safe area + margin. With the keyboard up:
 * its height + a small gap. `max` makes the total continuous (it stays at the resting value until the keyboard
 * covers it), so following the keyboard frame by frame never jumps. A worklet: runs on the UI thread.
 */
export function bottomPadding(keyboardHeight: number, insetBottom: number, restingMargin: number, keyboardGap: number) {
  "worklet";
  return Math.max(keyboardHeight + keyboardGap, insetBottom + restingMargin);
}

import { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { bottomPadding } from "./bottom-padding";

/**
 * Lifts a screen with the keyboard, frame by frame on the UI thread (`useAnimatedKeyboard` reads the real keyboard
 * frame; no JS listener, so nothing lags behind it). The whole lift is the root's bottom padding, a single node: the
 * content shrinks into the remaining space, and the resting margin turns into the keyboard gap without a jump (see
 * `bottomPadding`). Animating padding re-runs layout, acceptable here because it is the system's own keyboard motion.
 * Reduce Motion doesn't apply: following the keyboard is the system's motion, not ours.
 *
 * Unlike `KeyboardAvoidingView`, it works inside a `formSheet`: the keyboard height is measured from the bottom of the
 * screen, where the sheet ends too, while `KeyboardAvoidingView` compares its frame inside the sheet with the keyboard's
 * frame on screen and, at a medium detent, thinks nothing is covered.
 */
export function useKeyboardLift(insetBottom: number, restingMargin: number, keyboardGap: number) {
  const keyboard = useAnimatedKeyboard();
  return useAnimatedStyle(() => ({
    paddingBottom: bottomPadding(keyboard.height.get(), insetBottom, restingMargin, keyboardGap),
  }));
}

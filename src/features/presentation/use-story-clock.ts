import { useEffect, useRef, type Dispatch } from "react";
import { Animated, Easing } from "react-native";
import type { PlayerAction } from "./player";
import { elapsedProgress, stepDuration, type StoryStep } from "./story";

/**
 * Auto-advance clock of the story: a timer per step; the bar animates on the native thread and, after a pause,
 * resumes from where the clock says it was. Also restarts the player when the story itself is rebuilt.
 * Returns the `Animated.Value` (0..1) the progress bar shows.
 */
export function useStoryClock({
  steps,
  index,
  step,
  paused,
  screenReader,
  dispatch,
}: {
  steps: StoryStep[];
  index: number;
  step: StoryStep;
  paused: boolean;
  screenReader: boolean;
  dispatch: Dispatch<PlayerAction>;
}): Animated.Value {
  const progress = useRef(new Animated.Value(0)).current;
  const value = useRef(0);
  const lastIndex = useRef(-1);

  // The story changes only if the feed refreshes underneath: start over rather than point at a stale index.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else {
      // Starting over also restarts the step's clock (same index 0, but a fresh step).
      lastIndex.current = -1;
      dispatch({ type: "load", steps });
    }
  }, [steps, dispatch]);

  useEffect(() => {
    if (lastIndex.current !== index) {
      lastIndex.current = index;
      value.current = 0;
      progress.setValue(0);
    }
    const duration = stepDuration(step);
    if (duration == null || paused || screenReader) return;
    const from = value.current;
    // Native-driven: JS never sees the frames, so start explicitly from the saved point.
    progress.setValue(from);
    const startedAt = Date.now();
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: duration * (1 - from),
      easing: Easing.linear,
      useNativeDriver: true,
    });
    anim.start();
    // The clock lives here; the bar only shows it.
    const next = setTimeout(() => dispatch({ type: "next" }), duration * (1 - from));
    return () => {
      clearTimeout(next);
      anim.stop();
      value.current = elapsedProgress(from, Date.now() - startedAt, duration);
    };
  }, [index, paused, step, progress, screenReader, dispatch]);

  return progress;
}

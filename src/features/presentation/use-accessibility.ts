import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

function useFlag(read: () => Promise<boolean>, event: "reduceMotionChanged" | "screenReaderChanged") {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let active = true;
    read().then((v) => active && setOn(v));
    const sub = AccessibilityInfo.addEventListener(event, setOn);
    return () => {
      active = false;
      sub.remove();
    };
  }, [read, event]);
  return on;
}

const readReduceMotion = () => AccessibilityInfo.isReduceMotionEnabled();
const readScreenReader = () => AccessibilityInfo.isScreenReaderEnabled();

/** "Reducir movimiento": the focus-in becomes a plain fade. */
export const useReduceMotion = () => useFlag(readReduceMotion, "reduceMotionChanged");
/** With VoiceOver on the story doesn't advance by itself: it'd cut off what's being read. */
export const useScreenReader = () => useFlag(readScreenReader, "screenReaderChanged");

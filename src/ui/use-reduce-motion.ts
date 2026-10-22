import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** "Reducir movimiento" from iOS settings; `null` until it's known (don't start an animation yet). */
export function useReduceMotion(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => active && setOn(v))
      .catch(() => active && setOn(false));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setOn);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return on;
}

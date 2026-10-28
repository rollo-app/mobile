import { useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { nextTimer, type TimerDelay } from "./timer";

/** The timer's tick each second. */
const tick = () => {
  Promise.resolve(Haptics.selectionAsync()).catch(() => {});
};

/** The self-timer: the shutter starts the countdown (or cancels it), each second ticks, and at 0 it shoots. */
export function useSelfTimer(shoot: () => Promise<void>) {
  const [timer, setTimer] = useState<TimerDelay>(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  const shootRef = useRef(shoot);
  shootRef.current = shoot;
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      void shootRef.current();
      return;
    }
    const t = setTimeout(() => {
      if (countdown > 1) tick();
      setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function cycleTimer() {
    setTimer(nextTimer);
  }

  function onShutter() {
    if (countdown !== null) {
      setCountdown(null);
      return;
    }
    if (timer === 0) {
      void shoot();
      return;
    }
    tick();
    setCountdown(timer);
  }

  return { timer, cycleTimer, countdown, onShutter };
}

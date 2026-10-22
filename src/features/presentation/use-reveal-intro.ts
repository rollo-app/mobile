import { useCallback, useEffect, useState } from "react";
import { hasSeenRevealIntro, markRevealIntroSeen } from "@/storage/reveal-intro";

/**
 * Spike: the darkroom intro plays once per roll on this phone. `showIntro` is null while reading the
 * flag; `force` (the dev "Ver revelado" row) always shows it. `onIntroStart` remembers it right away,
 * so closing midway doesn't replay it.
 */
export function useRevealIntro(tripId: string | undefined, force: boolean) {
  const [showIntro, setShowIntro] = useState<boolean | null>(force ? true : null);

  useEffect(() => {
    if (force) return setShowIntro(true);
    if (!tripId) return;
    let active = true;
    void hasSeenRevealIntro(tripId).then((seen) => active && setShowIntro(!seen));
    return () => {
      active = false;
    };
  }, [tripId, force]);

  const onIntroStart = useCallback(() => {
    if (tripId) void markRevealIntroSeen(tripId);
  }, [tripId]);

  return { showIntro, onIntroStart };
}

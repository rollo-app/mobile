import { router } from "expo-router";
import { useEffect } from "react";
import { hasSeenPresentation, markPresentationSeen } from "@/storage/presentation";

/**
 * The first time a revealed roll is opened, plays the presentation once. It's marked as seen
 * when it opens, so closing it midway doesn't bring it back.
 */
export function useFirstPresentation(tripId: string | undefined, revealed: boolean) {
  useEffect(() => {
    if (!tripId || !revealed) return;
    let active = true;
    (async () => {
      if (await hasSeenPresentation(tripId)) return;
      if (!active) return;
      await markPresentationSeen(tripId);
      router.push("/presentation");
    })();
    return () => {
      active = false;
    };
  }, [tripId, revealed]);
}

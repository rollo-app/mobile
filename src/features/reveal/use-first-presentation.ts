import { router } from "expo-router";
import { useEffect } from "react";
import { hasSeenPresentation, markPresentationSeen } from "@/storage/presentation";

/**
 * The first time a revealed roll is opened, plays the presentation once. It's marked as seen
 * when it opens, so closing it midway doesn't bring it back. Waits for `ready` (the active trip's
 * saved id was read): before that the trip is a stand-in (the first of the list) and could be the wrong one.
 */
export function useFirstPresentation(tripId: string | undefined, revealed: boolean, ready: boolean) {
  useEffect(() => {
    if (!ready || !tripId || !revealed) return;
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
  }, [tripId, revealed, ready]);
}

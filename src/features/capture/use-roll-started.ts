import { router } from "expo-router";
import { useEffect } from "react";
import type { RollPhase } from "@/features/trips/phase";
import { hasSeenRollStarted, markRollStartedSeen } from "@/storage/roll-started";

/**
 * Spike: the first time the active roll is seen while it's shooting, shows the lock → camera moment
 * once. Waits for `ready` (the saved active trip was read) so it never fires for a stand-in trip.
 */
export function useRollStarted(tripId: string | undefined, phase: RollPhase | null, ready: boolean) {
  useEffect(() => {
    if (!ready || !tripId || phase !== "active") return;
    let active = true;
    (async () => {
      if (await hasSeenRollStarted(tripId)) return;
      if (!active) return;
      await markRollStartedSeen(tripId);
      router.push("/roll-started");
    })();
    return () => {
      active = false;
    };
  }, [tripId, phase, ready]);
}

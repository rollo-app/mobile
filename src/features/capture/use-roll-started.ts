import { router } from "expo-router";
import { useEffect } from "react";
import type { RollPhase } from "@/features/trips/phase";
import { hasSeenRollStarted, markRollStartedSeen } from "@/storage/roll-started";

// Rolls whose check is in flight: claimed synchronously, so two overlapping runs of the effect
// (before SecureStore remembers the roll) never open the screen twice.
const claimed = new Set<string>();

/**
 * The first time the active roll is seen while it's shooting, shows the lock → camera moment
 * once. Waits for `ready` (the saved active trip was read) so it never fires for a stand-in trip.
 */
export function useRollStarted(tripId: string | undefined, phase: RollPhase | null, ready: boolean) {
  useEffect(() => {
    if (!ready || !tripId || phase !== "active" || claimed.has(tripId)) return;
    claimed.add(tripId);
    (async () => {
      if (!(await hasSeenRollStarted(tripId))) {
        await markRollStartedSeen(tripId);
        router.push("/roll-started");
      }
    })()
      .catch(() => {})
      .finally(() => claimed.delete(tripId));
  }, [tripId, phase, ready]);
}

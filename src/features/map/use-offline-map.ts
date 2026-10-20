import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { PackInfo } from "./offline-plan";
import { getOfflineSyncState, readOfflineSummary, subscribeOfflineSync } from "./offline-sync";
import type { OfflineMapState } from "./offline-status";

/** What the phone has for use without signal plus the state of the automatic download. */
export function useOfflineMap(): { state: OfflineMapState; packs: PackInfo[]; reload: () => Promise<void> } {
  const sync = useSyncExternalStore(subscribeOfflineSync, getOfflineSyncState);
  const [summary, setSummary] = useState<{ packs: PackInfo[]; bytes: number; incomplete: number }>({ packs: [], bytes: 0, incomplete: 0 });

  const reload = useCallback(async () => {
    try {
      setSummary(await readOfflineSummary());
    } catch {
      // keep what was shown
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  // Zones appear when a download ends.
  useEffect(() => {
    if (!sync.running) void reload();
  }, [sync.running, reload]);

  const state: OfflineMapState = {
    zones: summary.packs.length,
    bytes: summary.bytes,
    incomplete: summary.incomplete,
    ...sync,
  };
  return { state, packs: summary.packs, reload };
}

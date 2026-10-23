import { useEffect } from "react";
import { AppState } from "react-native";
import { scheduleOfflineSync } from "./offline-sync";

/** Keeps the offline maps up to date: when the app opens and each time it returns to foreground. */
export function useOfflineMapSync() {
  useEffect(() => {
    scheduleOfflineSync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") scheduleOfflineSync();
    });
    return () => subscription.remove();
  }, []);
}

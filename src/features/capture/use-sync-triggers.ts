import { useEffect } from "react";
import { AppState } from "react-native";
import { syncQueue } from "./sync";

/** Uploads the queue when the app opens and each time it returns to foreground. */
export function useSyncTriggers() {
  useEffect(() => {
    void syncQueue();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncQueue();
    });
    return () => subscription.remove();
  }, []);
}

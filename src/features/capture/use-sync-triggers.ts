import { useEffect } from "react";
import { AppState } from "react-native";
import { registerBackgroundUpload } from "./background-upload";
import { syncQueue } from "./sync";

/**
 * Uploads the queue when the app opens and each time it returns to foreground, and makes sure the
 * background task is registered (also on foreground: the first trip may have been created since launch).
 */
export function useSyncTriggers() {
  useEffect(() => {
    void syncQueue();
    void registerBackgroundUpload();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void syncQueue();
      void registerBackgroundUpload();
    });
    return () => subscription.remove();
  }, []);
}

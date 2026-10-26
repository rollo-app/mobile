import { useEffect } from "react";
import { AppState } from "react-native";
import { syncMoments } from "./moment-sync";

/** Keeps the moment notifications up to date: when the app opens and each time it returns to foreground. */
export function useMomentSync() {
  useEffect(() => {
    void syncMoments();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncMoments();
    });
    return () => subscription.remove();
  }, []);
}

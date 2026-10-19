import { useEffect } from "react";
import { AppState } from "react-native";
import { syncQueue } from "./sync";

/** Sube la cola al abrir la app y cada vez que vuelve a primer plano. */
export function useSyncTriggers() {
  useEffect(() => {
    void syncQueue();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncQueue();
    });
    return () => subscription.remove();
  }, []);
}

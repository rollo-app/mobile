import { useEffect } from "react";
import { AppState } from "react-native";
import { syncPushToken } from "./push-token";

/**
 * Once the account is ready (signed in, profile complete), registers this phone's push token, and
 * again every time the app returns to the foreground: the token can change, and the permission may
 * have been granted from iOS Settings meanwhile. Without permission it does nothing.
 */
export function usePushRegistration(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    void syncPushToken();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncPushToken();
    });
    return () => subscription.remove();
  }, [ready]);
}

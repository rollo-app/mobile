import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { pushPermission, requestPushPermission, type PushPermission } from "./push-permission";
import { syncPushToken } from "./push-token";

/**
 * The system's notification permission, read again whenever the app comes back to the foreground
 * (it may have been changed in iOS Settings). `enable` shows the system dialog and, if allowed,
 * registers this phone's token. `null` until it's read.
 */
export function usePushPermission() {
  const [permission, setPermission] = useState<PushPermission | null>(null);

  const refresh = useCallback(async () => setPermission(await pushPermission()), []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  async function enable() {
    if (await requestPushPermission()) await syncPushToken();
    await refresh();
  }

  return { permission, enable };
}

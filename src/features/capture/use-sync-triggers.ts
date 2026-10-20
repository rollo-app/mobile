import * as Network from "expo-network";
import { useEffect } from "react";
import { AppState } from "react-native";
import { registerBackgroundUpload } from "./background-upload";
import { syncQueue } from "./sync";

/** The network flaps when it comes back: wait for it to settle before uploading. */
const RECONNECT_DEBOUNCE_MS = 2000;

const isOnline = (s: { isConnected?: boolean; isInternetReachable?: boolean }) => s.isInternetReachable ?? s.isConnected ?? false;

/**
 * Uploads the queue when the app opens, each time it returns to foreground and when the network
 * comes back (ignoring the backoff, which only existed because there was no network). Also makes
 * sure the background task is registered (on foreground too: the first trip may have been created
 * since launch).
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

    let online: boolean | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = (next: boolean) => {
      const wasOffline = online === false;
      online = next;
      if (!next) {
        clearTimeout(timer);
        timer = undefined;
      } else if (wasOffline) {
        clearTimeout(timer);
        timer = setTimeout(() => void syncQueue({ ignoreBackoff: true }), RECONNECT_DEBOUNCE_MS);
      }
    };
    const network = Network.addNetworkStateListener((s) => onChange(isOnline(s)));
    void Network.getNetworkStateAsync()
      .then((s) => {
        // An event that arrived first is newer than this reading.
        if (online === null) onChange(isOnline(s));
      })
      .catch(() => {});

    return () => {
      subscription.remove();
      network.remove();
      clearTimeout(timer);
    };
  }, []);
}

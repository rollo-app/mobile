import * as Network from "expo-network";
import { useEffect } from "react";
import { AppState } from "react-native";
import { retryPendingLogouts } from "./pending-logout";

const isOnline = (s: { isConnected?: boolean; isInternetReachable?: boolean }) => s.isInternetReachable ?? s.isConnected ?? false;

/** Finishes the logouts that didn't reach the server: on launch, on foreground and when the network comes back. */
export function useRetryPendingLogouts() {
  useEffect(() => {
    void retryPendingLogouts();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void retryPendingLogouts();
    });
    const network = Network.addNetworkStateListener((s) => {
      if (isOnline(s)) void retryPendingLogouts();
    });
    return () => {
      subscription.remove();
      network.remove();
    };
  }, []);
}

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import Storage from "expo-sqlite/kv-store";
import { AppState } from "react-native";

const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;

/** How long the cache is kept on the phone (also the persister's `maxAge`). */
export const CACHE_MAX_AGE = 7 * DAY;

/**
 * The app's data client. `offlineFirst`: it always tries to fetch, but with no
 * signal it shows what's cached. Data is "fresh" for 30 s: within that
 * window nobody refetches the same trip.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "offlineFirst",
        staleTime: 30 * SECOND,
        gcTime: CACHE_MAX_AGE,
        retry: 1,
      },
    },
  });
}

export const queryClient = createQueryClient();

export const persister = createAsyncStoragePersister({ storage: Storage, key: "rollo.query-cache" });

/**
 * The app's focus is AppState. Without NetInfo we can't tell if there's signal: we treat
 * the app as "online" while it's in the foreground, so paused requests retry on return.
 */
export function connectAppState() {
  const subscription = AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
  onlineManager.setEventListener((setOnline) => {
    const sub = AppState.addEventListener("change", (state) => setOnline(state === "active"));
    return () => sub.remove();
  });
  return () => subscription.remove();
}

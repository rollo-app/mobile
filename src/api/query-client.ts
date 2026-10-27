import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import Storage from "expo-sqlite/kv-store";
import { AppState } from "react-native";
import { ApiError } from "./client";

const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;

/**
 * For data only you change (your profile, your settings, who you blocked): every mutation that
 * edits it already sets or invalidates the cache, so nobody else can leave it outdated and
 * refetching it on every mount is wasted. Not for data that moves because of other people (rolls,
 * feeds, friends, requests, other users' profiles): those keep the default.
 */
export const OWN_DATA_STALE_TIME = 5 * 60 * SECOND;

/** How long the cache is kept on the phone (also the persister's `maxAge`). */
export const CACHE_MAX_AGE = 7 * DAY;

/** One retry, only for what can change by itself: no signal or a server error. A 4xx would fail again. */
function retryOnce(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

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
        retry: retryOnce,
      },
      // A mutation runs right away and fails once: with no signal the user sees OFFLINE_MESSAGE under
      // the form instead of a request paused in silence. Local writes (the capture queue) need this too.
      mutations: {
        networkMode: "always",
        retry: 0,
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

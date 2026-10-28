import * as SecureStore from "expo-secure-store";

// The full-screen app intro: shown once per phone, right after a new account completes its profile.
// Persisted: don't rename.
const PENDING_KEY = "rollo.appIntroPending";
const SEEN_KEY = "rollo.appIntroSeen";

/** Queues the intro for the next time the app opens, unless this phone already showed it. */
export async function markAppIntroPending(): Promise<void> {
  if ((await SecureStore.getItemAsync(SEEN_KEY)) === "1") return;
  await SecureStore.setItemAsync(PENDING_KEY, "1");
}

/** True once when the intro is queued and wasn't shown before; clears the queue and remembers it was shown. */
export async function takeAppIntroPending(): Promise<boolean> {
  if ((await SecureStore.getItemAsync(PENDING_KEY)) !== "1") return false;
  await SecureStore.deleteItemAsync(PENDING_KEY);
  if ((await SecureStore.getItemAsync(SEEN_KEY)) === "1") return false;
  await SecureStore.setItemAsync(SEEN_KEY, "1");
  return true;
}

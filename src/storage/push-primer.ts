import * as SecureStore from "expo-secure-store";

/** Whether this phone already showed our own "¿Te avisamos…?" before the system dialog. Persisted: don't rename. */
const PUSH_PRIMER_KEY = "rollo.pushPrimerSeen";

export async function hasSeenPushPrimer(): Promise<boolean> {
  return (await SecureStore.getItemAsync(PUSH_PRIMER_KEY)) === "1";
}

export async function markPushPrimerSeen(): Promise<void> {
  await SecureStore.setItemAsync(PUSH_PRIMER_KEY, "1");
}

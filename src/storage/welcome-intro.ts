import * as SecureStore from "expo-secure-store";

// Whether this phone already showed the Rollo tab's welcome with its animated mark. Persisted: don't rename.
const KEY = "rollo.welcomeIntroSeen";

export async function hasSeenWelcomeIntro(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY)) === "1";
}

export async function markWelcomeIntroSeen(): Promise<void> {
  await SecureStore.setItemAsync(KEY, "1");
}

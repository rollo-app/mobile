import * as SecureStore from "expo-secure-store";

// Spike: whether this phone already showed "Arrancó el rollo" for a roll. Persisted: don't rename.
const seenKey = (tripId: string) => `rollo.rollStartedSeen.${tripId}`;

export async function hasSeenRollStarted(tripId: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(seenKey(tripId))) === "1";
}

export async function markRollStartedSeen(tripId: string): Promise<void> {
  await SecureStore.setItemAsync(seenKey(tripId), "1");
}

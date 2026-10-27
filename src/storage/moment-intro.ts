import * as SecureStore from "expo-secure-store";

// Whether this phone already showed the daily moment's intro for a roll's day. Persisted: don't rename.
const seenKey = (tripId: string, day: string) => `rollo.momentIntroSeen.${tripId}.${day}`;

export async function hasSeenMomentIntro(tripId: string, day: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(seenKey(tripId, day))) === "1";
}

export async function markMomentIntroSeen(tripId: string, day: string): Promise<void> {
  await SecureStore.setItemAsync(seenKey(tripId, day), "1");
}

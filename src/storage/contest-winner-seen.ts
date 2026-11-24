import * as SecureStore from "expo-secure-store";

// Whether this phone already played the photo contest's winner reveal for an event. Persisted: don't rename.
const seenKey = (tripId: string) => `rollo.contestWinnerSeen.${tripId}`;

export async function hasSeenContestWinner(tripId: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(seenKey(tripId))) === "1";
}

export async function markContestWinnerSeen(tripId: string): Promise<void> {
  await SecureStore.setItemAsync(seenKey(tripId), "1");
}

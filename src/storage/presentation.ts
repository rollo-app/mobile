import * as SecureStore from "expo-secure-store";

const seenKey = (tripId: string) => `rollo.presentation-seen.${tripId}`;

/** Whether this phone already played the reveal presentation for the roll. */
export async function hasSeenPresentation(tripId: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(seenKey(tripId))) === "1";
}

export async function markPresentationSeen(tripId: string): Promise<void> {
  await SecureStore.setItemAsync(seenKey(tripId), "1");
}

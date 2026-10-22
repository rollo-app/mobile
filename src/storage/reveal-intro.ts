import * as SecureStore from "expo-secure-store";

const seenKey = (tripId: string) => `rollo.revealIntroSeen.${tripId}`;

/**
 * Whether this phone already started the darkroom reveal intro for the roll. Separate from
 * `presentation-seen` (the automatic opening), which is set before the presentation even mounts.
 */
export async function hasSeenRevealIntro(tripId: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(seenKey(tripId))) === "1";
}

export async function markRevealIntroSeen(tripId: string): Promise<void> {
  await SecureStore.setItemAsync(seenKey(tripId), "1");
}

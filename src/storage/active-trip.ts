import * as SecureStore from "expo-secure-store";

/** Id of the last trip the user opened (the active one). The key is persisted data: don't rename it. */
const ACTIVE_TRIP_KEY = "rollo.activeTrip";

export async function getActiveTripId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_TRIP_KEY);
}

export async function setActiveTripId(tripId: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_TRIP_KEY, tripId);
}

export async function clearActiveTripId(): Promise<void> {
  await SecureStore.deleteItemAsync(ACTIVE_TRIP_KEY);
}

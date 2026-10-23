import * as SecureStore from "expo-secure-store";

/** Id of the last trip the user opened (the active one). The key is persisted data: don't rename it. */
const ACTIVE_TRIP_KEY = "rollo.activeTrip";

type Listener = (tripId: string | null) => void;
const listeners = new Set<Listener>();

export async function getActiveTripId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_TRIP_KEY);
}

export async function setActiveTripId(tripId: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_TRIP_KEY, tripId);
  listeners.forEach((listener) => listener(tripId));
}

export async function clearActiveTripId(): Promise<void> {
  await SecureStore.deleteItemAsync(ACTIVE_TRIP_KEY);
  listeners.forEach((listener) => listener(null));
}

/**
 * Calls `listener` with the new id every time the active trip is set or cleared (after it's saved),
 * so every screen showing the active trip follows a switch made anywhere. Returns the unsubscribe.
 */
export function onActiveTripIdChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

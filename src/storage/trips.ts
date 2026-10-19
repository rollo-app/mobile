import * as SecureStore from "expo-secure-store";

/**
 * Trips the user is in. There are no accounts: each trip has its own token,
 * stored in the phone's keychain (SecureStore) and kept separate from the list.
 */

export type Role = "admin" | "member";

export type TripSession = {
  tripId: string;
  tripName: string;
  joinCode: string;
  memberId: string;
  memberName: string;
  role: Role;
  token: string;
};

export type TripSummary = Omit<TripSession, "token"> & { lastOpenedAt: number };

const INDEX_KEY = "rollo.trips";
const tokenKey = (tripId: string) => `rollo.token.${tripId}`;

async function readIndex(): Promise<TripSummary[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TripSummary[];
  } catch {
    return [];
  }
}

async function writeIndex(trips: TripSummary[]) {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(trips));
}

/** Saves (or updates) a trip and puts it first in the list. */
export async function saveSession({ token, ...summary }: TripSession): Promise<void> {
  const others = (await readIndex()).filter((t) => t.tripId !== summary.tripId);
  await SecureStore.setItemAsync(tokenKey(summary.tripId), token);
  await writeIndex([{ ...summary, lastOpenedAt: Date.now() }, ...others]);
}

/** Saved trips, most recent first. Never includes tokens. */
export async function listTrips(): Promise<TripSummary[]> {
  return readIndex();
}

/** Marks a trip as opened: it becomes the first one, which is the active trip. */
export async function markOpened(tripId: string): Promise<void> {
  const trips = await readIndex();
  const opened = trips.find((t) => t.tripId === tripId);
  if (!opened) return;
  await writeIndex([{ ...opened, lastOpenedAt: Date.now() }, ...trips.filter((t) => t !== opened)]);
}

export async function getToken(tripId: string): Promise<string | null> {
  return SecureStore.getItemAsync(tokenKey(tripId));
}

export async function removeTrip(tripId: string): Promise<void> {
  await SecureStore.deleteItemAsync(tokenKey(tripId));
  await writeIndex((await readIndex()).filter((t) => t.tripId !== tripId));
}

/** Changes your name in a saved trip. Doesn't touch the token or the list order. */
export async function updateMemberName(tripId: string, name: string): Promise<void> {
  const trips = await readIndex();
  await writeIndex(trips.map((t) => (t.tripId === tripId ? { ...t, memberName: name } : t)));
}

import * as SecureStore from "expo-secure-store";

/**
 * Viajes en los que está el usuario. No hay cuentas: cada viaje tiene su token,
 * guardado en el llavero del celular (SecureStore) y separado de la lista.
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

/** Guarda (o actualiza) un viaje y lo pone primero en la lista. */
export async function saveSession({ token, ...summary }: TripSession): Promise<void> {
  const others = (await readIndex()).filter((t) => t.tripId !== summary.tripId);
  await SecureStore.setItemAsync(tokenKey(summary.tripId), token);
  await writeIndex([{ ...summary, lastOpenedAt: Date.now() }, ...others]);
}

/** Viajes guardados, el más reciente primero. Nunca incluye tokens. */
export async function listTrips(): Promise<TripSummary[]> {
  return readIndex();
}

/** Marca un viaje como abierto: pasa a ser el primero, que es el viaje activo. */
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

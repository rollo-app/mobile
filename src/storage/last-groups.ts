import * as SecureStore from "expo-secure-store";

/** The event groups a guest last sent photos to, per event: the caption screen starts with them. The key is persisted data: don't rename it. */
const key = (tripId: string) => `rollo.lastGroups.${tripId}`;

export async function getLastGroups(tripId: string): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(key(tripId));
  if (!raw) return [];
  try {
    const ids: unknown = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export async function setLastGroups(tripId: string, groupIds: string[]): Promise<void> {
  await SecureStore.setItemAsync(key(tripId), JSON.stringify(groupIds));
}

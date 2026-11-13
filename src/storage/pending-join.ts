import * as SecureStore from "expo-secure-store";

/**
 * A join link opened before the account was ready: the code waits here until the profile is complete.
 * The key is persisted data: don't rename it.
 */
const PENDING_JOIN_KEY = "rollo.pendingJoin";

export type PendingJoin = { code: string };

export async function getPendingJoin(): Promise<PendingJoin | null> {
  const raw = await SecureStore.getItemAsync(PENDING_JOIN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingJoin>;
    return typeof parsed.code === "string" ? { code: parsed.code } : null;
  } catch {
    return null;
  }
}

export async function setPendingJoin(pending: PendingJoin): Promise<void> {
  await SecureStore.setItemAsync(PENDING_JOIN_KEY, JSON.stringify(pending));
}

export async function clearPendingJoin(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_JOIN_KEY);
}

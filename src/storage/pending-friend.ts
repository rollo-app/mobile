import * as SecureStore from "expo-secure-store";

/**
 * A friend link opened before the account was ready: the claim token (valid 24 h) waits here until the
 * profile is complete. The key is persisted data: don't rename it.
 */
const PENDING_FRIEND_KEY = "rollo.pendingFriend";

export type PendingFriend = { claimToken: string; creatorName: string };

export async function getPendingFriend(): Promise<PendingFriend | null> {
  const raw = await SecureStore.getItemAsync(PENDING_FRIEND_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingFriend>;
    return typeof parsed.claimToken === "string" ? { claimToken: parsed.claimToken, creatorName: parsed.creatorName ?? "" } : null;
  } catch {
    return null;
  }
}

export async function setPendingFriend(pending: PendingFriend): Promise<void> {
  await SecureStore.setItemAsync(PENDING_FRIEND_KEY, JSON.stringify(pending));
}

export async function clearPendingFriend(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_FRIEND_KEY);
}

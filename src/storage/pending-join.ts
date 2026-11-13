import * as SecureStore from "expo-secure-store";

/**
 * A join link opened before the account was ready: the code waits here until the profile is complete (24 h at most).
 * The key is persisted data: don't rename it.
 */
const PENDING_JOIN_KEY = "rollo.pendingJoin";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PendingJoin = { code: string };

export async function getPendingJoin(now: number = Date.now()): Promise<PendingJoin | null> {
  const raw = await SecureStore.getItemAsync(PENDING_JOIN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingJoin & { savedAt: number }>;
    if (typeof parsed.code !== "string" || typeof parsed.savedAt !== "number") return null;
    if (now - parsed.savedAt > MAX_AGE_MS) {
      await clearPendingJoin();
      return null;
    }
    return { code: parsed.code };
  } catch {
    return null;
  }
}

export async function setPendingJoin(pending: PendingJoin, now: number = Date.now()): Promise<void> {
  await SecureStore.setItemAsync(PENDING_JOIN_KEY, JSON.stringify({ code: pending.code, savedAt: now }));
}

export async function clearPendingJoin(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_JOIN_KEY);
}

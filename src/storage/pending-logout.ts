import * as SecureStore from "expo-secure-store";

/**
 * Sessions logged out while the server couldn't be reached: they stay valid there (and keep getting
 * that account's pushes) until a retry logs them out. The key is persisted data: don't rename it.
 */
const PENDING_LOGOUT_KEY = "rollo.pendingLogout";

export async function getPendingLogouts(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(PENDING_LOGOUT_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export async function addPendingLogout(session: string): Promise<void> {
  const pending = await getPendingLogouts();
  if (pending.includes(session)) return;
  await SecureStore.setItemAsync(PENDING_LOGOUT_KEY, JSON.stringify([...pending, session]));
}

export async function removePendingLogout(session: string): Promise<void> {
  const pending = (await getPendingLogouts()).filter((t) => t !== session);
  if (pending.length) await SecureStore.setItemAsync(PENDING_LOGOUT_KEY, JSON.stringify(pending));
  else await SecureStore.deleteItemAsync(PENDING_LOGOUT_KEY);
}

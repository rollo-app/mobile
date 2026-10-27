import * as SecureStore from "expo-secure-store";

/** The id of the account with the session, so the photo queue knows whose photos are whose. The key is persisted data: don't rename it. */
const SESSION_USER_KEY = "rollo.sessionUserId";

export async function getSessionUserIdStored(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_USER_KEY);
}

export async function setSessionUserId(userId: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_USER_KEY, userId);
}

export async function clearSessionUserId(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_USER_KEY);
}

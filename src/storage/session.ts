import * as SecureStore from "expo-secure-store";

/** The account's session token, in the phone's keychain. The key is persisted data: don't rename it. */
const SESSION_KEY = "rollo.session";

export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function setSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

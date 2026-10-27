import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { base64url } from "@/features/auth/link-verifier";

/**
 * The push token this phone last registered with the server, and for which session: while both
 * still match there is nothing to send. The session is stored as a SHA-256 hash, never in the clear.
 * The key is persisted data: don't rename it.
 */
const PUSH_TOKEN_REGISTERED_KEY = "rollo.pushTokenRegistered";

async function fingerprint(token: string, session: string): Promise<string> {
  const hash = await digest(CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(session));
  return `${token}|${base64url(new Uint8Array(hash))}`;
}

export async function isPushTokenRegistered(token: string, session: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(PUSH_TOKEN_REGISTERED_KEY)) === (await fingerprint(token, session));
}

export async function markPushTokenRegistered(token: string, session: string): Promise<void> {
  await SecureStore.setItemAsync(PUSH_TOKEN_REGISTERED_KEY, await fingerprint(token, session));
}

export async function clearPushTokenRegistered(): Promise<void> {
  await SecureStore.deleteItemAsync(PUSH_TOKEN_REGISTERED_KEY);
}

import * as SecureStore from "expo-secure-store";

/**
 * The secret half of the login email's link: only the phone that asked for the code can use the link
 * (the server got its SHA-256). One at a time, overwritten by every new request. The key is persisted
 * data: don't rename it.
 */
const LOGIN_LINK_VERIFIER_KEY = "rollo.loginLinkVerifier";

export type LoginLinkVerifier = { email: string; verifier: string };

export async function getLoginLinkVerifier(): Promise<LoginLinkVerifier | null> {
  const raw = await SecureStore.getItemAsync(LOGIN_LINK_VERIFIER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LoginLinkVerifier>;
    return typeof parsed.email === "string" && typeof parsed.verifier === "string"
      ? { email: parsed.email, verifier: parsed.verifier }
      : null;
  } catch {
    return null;
  }
}

export async function setLoginLinkVerifier(value: LoginLinkVerifier): Promise<void> {
  await SecureStore.setItemAsync(LOGIN_LINK_VERIFIER_KEY, JSON.stringify(value));
}

export async function clearLoginLinkVerifier(): Promise<void> {
  await SecureStore.deleteItemAsync(LOGIN_LINK_VERIFIER_KEY);
}

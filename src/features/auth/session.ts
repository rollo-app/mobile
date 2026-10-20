import { ApiError, createApiClient, setUnauthorizedHandler } from "@/api/client";
import { queryClient } from "@/api/query-client";
import { API_URL } from "@/config";
import { clearActiveTripId } from "@/storage/active-trip";
import { clearSessionToken, getSessionToken, setSessionToken } from "@/storage/session";

/**
 * The account's session: the token lives in the keychain and this module tells whoever is
 * listening (the gate, the screens) when it changes. Logging out also clears the cache and the
 * active trip, but never the queue of pending photos.
 */

type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

const notify = (token: string | null) => listeners.forEach((l) => l(token));

export const getSession = getSessionToken;

export async function signIn(token: string): Promise<void> {
  await setSessionToken(token);
  notify(token);
}

/** Closes the session on the phone only (the server call, if any, is made by whoever asks). */
export async function signOut(): Promise<void> {
  await clearSessionToken();
  await clearActiveTripId();
  queryClient.clear();
  notify(null);
}

/** A client with the session token; if there's no session it fails like the server would. */
export async function authedClient() {
  const token = await getSessionToken();
  if (!token) throw new ApiError(401, SESSION_INVALID);
  return createApiClient({ baseUrl: API_URL, token });
}

export const SESSION_INVALID = "Sesión inválida, volvé a entrar";

// A 401 closes the session once, but only if it's still the one the server rejected.
setUnauthorizedHandler((rejected) => {
  void getSessionToken().then((current) => (current === rejected ? signOut() : undefined));
});

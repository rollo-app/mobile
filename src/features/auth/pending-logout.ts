import { ApiError, createApiClient, unwrap } from "@/api/client";
import { API_URL } from "@/config";
import { getPendingLogouts, removePendingLogout } from "@/storage/pending-logout";

/** Logs `session` out on the server. Throws like any request (an `ApiError`, or a network error). */
export async function logoutOnServer(session: string): Promise<void> {
  await unwrap(createApiClient({ baseUrl: API_URL, token: session }).POST("/auth/logout"));
}

let running: Promise<void> | null = null;

/**
 * Retries the logouts that didn't reach the server (on launch, on foreground and when the network
 * comes back). Silent and best effort: a session is forgotten once the server logs it out or says
 * it's already invalid (401); otherwise it waits for the next try. Never touches the current session.
 */
export function retryPendingLogouts(): Promise<void> {
  running ??= (async () => {
    try {
      for (const session of await getPendingLogouts()) {
        try {
          await logoutOnServer(session);
          await removePendingLogout(session);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) await removePendingLogout(session);
        }
      }
    } catch {
      // The keychain failed: the next trigger tries again.
    } finally {
      running = null;
    }
  })();
  return running;
}

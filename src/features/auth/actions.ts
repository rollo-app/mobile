import { ApiError, createApiClient, unwrap, type Schemas } from "@/api/client";
import { queryClient } from "@/api/query-client";
import { API_URL } from "@/config";
import { forgetPushToken } from "@/features/notifications/push-token";
import { addPendingLogout } from "@/storage/pending-logout";
import { getSessionToken } from "@/storage/session";
import { logoutOnServer } from "./pending-logout";
import { authedClient, signIn, signOut } from "./session";

export type User = Schemas["User"];

export const meKey = ["me"] as const;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Sends the 6-character code to the email. */
export async function startEmailLogin(email: string): Promise<void> {
  await unwrap(createApiClient({ baseUrl: API_URL }).POST("/auth/email/start", { body: { email: normalizeEmail(email) } }));
}

/** Checks the code and, if it's right, saves the session. */
export async function verifyCode(email: string, code: string): Promise<{ user: User; isNew: boolean }> {
  const { token, user, isNew } = await unwrap(
    createApiClient({ baseUrl: API_URL }).POST("/auth/email/verify", {
      body: { email: normalizeEmail(email), code: code.trim() },
    }),
  );
  // Seeded before the session flips, so the gate doesn't wait for a second request.
  queryClient.setQueryData(meKey, user);
  await signIn(token);
  return { user, isNew };
}

export async function fetchMe(): Promise<User> {
  return unwrap((await authedClient()).GET("/me"));
}

/**
 * Logs out. First this phone stops getting the account's pushes (while the session still works);
 * the phone's session is cleared even if the server can't be reached. Then the session stays valid
 * on the server, so it's kept as a pending logout that `retryPendingLogouts` finishes later.
 */
export async function logout(): Promise<void> {
  await forgetPushToken();
  const session = await getSessionToken();
  if (session) {
    try {
      await logoutOnServer(session);
    } catch (e) {
      // A 401 means the server already dropped it.
      if (!(e instanceof ApiError && e.status === 401)) await addPendingLogout(session).catch(() => {});
    }
  }
  await signOut();
}

/** Deletes the account and everything in it; only on success the session is cleared. */
export async function deleteAccount(): Promise<void> {
  await unwrap((await authedClient()).DELETE("/me"));
  await signOut();
}

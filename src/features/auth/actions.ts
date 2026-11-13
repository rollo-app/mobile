import { ApiError, createApiClient, unwrap, type Schemas } from "@/api/client";
import { queryClient } from "@/api/query-client";
import { API_URL } from "@/config";
import { clearLoginLinkVerifier, getLoginLinkVerifier, setLoginLinkVerifier } from "@/storage/login-link-verifier";
import { getAppleAccount } from "./apple";
import { getGoogleAccount } from "./google";
import { setPendingGooglePhoto } from "./google-photo";
import { createLinkVerifier } from "./link-verifier";
import { forgetPushToken } from "@/features/notifications/push-token";
import { addPendingLogout } from "@/storage/pending-logout";
import { getSessionToken } from "@/storage/session";
import { logoutOnServer } from "./pending-logout";
import { discardAccountQueue } from "@/features/capture/account-queue";
import { authedClient, getSessionUserId, signIn, signOut } from "./session";

export type User = Schemas["User"];

export const meKey = ["me"] as const;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Sends the 6-character code (and the magic link) to the email. The link only works on this phone: the
 * server gets the challenge and the verifier stays here, replacing the one of any earlier request.
 */
export async function startEmailLogin(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  const { verifier, challenge } = await createLinkVerifier();
  await setLoginLinkVerifier({ email: normalized, verifier });
  await unwrap(
    createApiClient({ baseUrl: API_URL }).POST("/auth/email/start", { body: { email: normalized, linkChallenge: challenge } }),
  );
}

/** Checks the code and, if it's right, saves the session. */
export async function verifyCode(email: string, code: string): Promise<{ user: User; isNew: boolean }> {
  return startSession(
    await unwrap(
      createApiClient({ baseUrl: API_URL }).POST("/auth/email/verify", {
        body: { email: normalizeEmail(email), code: code.trim() },
      }),
    ),
  );
}

export const LINK_FROM_OTHER_REQUEST = "Este link es de otro pedido. Pedí un código nuevo desde este iPhone.";

/** The magic link isn't for this phone's last request (asked elsewhere, or someone else's link). */
export class LinkFromOtherRequestError extends Error {
  constructor() {
    super(LINK_FROM_OTHER_REQUEST);
  }
}

/**
 * Same as `verifyCode`, with the token from the email's magic link (rollo://login) instead of the code.
 * Only a link for the email this phone asked for is sent, with its verifier; anything else never reaches
 * the server, so nobody can sign this phone into their account with their own link.
 */
export async function verifyMagicLink(email: string, token: string): Promise<{ user: User; isNew: boolean }> {
  const normalized = normalizeEmail(email);
  const stored = await getLoginLinkVerifier();
  if (!stored || stored.email !== normalized) throw new LinkFromOtherRequestError();
  const result = await startSession(
    await unwrap(
      createApiClient({ baseUrl: API_URL }).POST("/auth/email/verify-link", {
        body: { email: normalized, token, verifier: stored.verifier },
      }),
    ),
  );
  await clearLoginLinkVerifier();
  return result;
}

/**
 * Signs in with the Google account the user picks: Google's ID token goes to the server, which checks it and answers
 * like the code. Null when the user closed Google's picker (nothing changes).
 */
export async function signInWithGoogle(): Promise<{ user: User; isNew: boolean } | null> {
  const account = await getGoogleAccount();
  if (!account) return null;
  const session = await unwrap(createApiClient({ baseUrl: API_URL }).POST("/auth/google", { body: { idToken: account.idToken } }));
  // An account still without a photo gets the Google one by default in "Completá tu perfil" (set before the gate flips to it).
  setPendingGooglePhoto(session.isNew && !session.user.avatarUrl ? account.photo : null);
  return startSession(session);
}

/**
 * Signs in with Apple: the identity token (and the name, which Apple gives only on the first sign-in) goes to the server, which
 * answers like the code. Null when the user canceled Apple's sheet (nothing changes).
 */
export async function signInWithApple(): Promise<{ user: User; isNew: boolean } | null> {
  const account = await getAppleAccount();
  if (!account) return null;
  const body = { identityToken: account.identityToken, ...(account.name ? { name: account.name } : {}) };
  return startSession(await unwrap(createApiClient({ baseUrl: API_URL }).POST("/auth/apple", { body })));
}

async function startSession({ token, user, isNew }: { token: string; user: User; isNew: boolean }) {
  // Seeded before the session flips, so the gate doesn't wait for a second request.
  queryClient.setQueryData(meKey, user);
  await signIn(token, user.id);
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

/** Deletes the account and everything in it (also its pending photos on this phone); only on success the session is cleared. */
export async function deleteAccount(): Promise<void> {
  const userId = await getSessionUserId();
  await unwrap((await authedClient()).DELETE("/me"));
  // Its pending photos go with it (logging out never deletes them, deleting the account does).
  if (userId) await discardAccountQueue(userId).catch(() => {});
  await signOut();
}

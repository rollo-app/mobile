import { createApiClient, unwrap, type Schemas } from "@/api/client";
import { queryClient } from "@/api/query-client";
import { API_URL } from "@/config";
import { clearLoginLinkVerifier, getLoginLinkVerifier, setLoginLinkVerifier } from "@/storage/login-link-verifier";
import { createLinkVerifier } from "./link-verifier";
import { authedClient, signIn, signOut } from "./session";

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

async function startSession({ token, user, isNew }: { token: string; user: User; isNew: boolean }) {
  // Seeded before the session flips, so the gate doesn't wait for a second request.
  queryClient.setQueryData(meKey, user);
  await signIn(token);
  return { user, isNew };
}

export async function fetchMe(): Promise<User> {
  return unwrap((await authedClient()).GET("/me"));
}

/** Logs out. The phone's session is cleared even if the server can't be reached. */
export async function logout(): Promise<void> {
  try {
    await unwrap((await authedClient()).POST("/auth/logout"));
  } catch {
    // Nothing to do: leaving the session on the server expires on its own.
  }
  await signOut();
}

/** Deletes the account and everything in it; only on success the session is cleared. */
export async function deleteAccount(): Promise<void> {
  await unwrap((await authedClient()).DELETE("/me"));
  await signOut();
}

import { unwrap } from "@/api/client";
import { authedClient } from "@/features/auth/session";

// openapi-fetch URL-encodes path params itself: the raw token goes in (encoding it here would do it twice).

/** Registers this phone's Expo push token for the account (idempotent). */
export async function registerPushToken(token: string): Promise<void> {
  await unwrap((await authedClient()).PUT("/me/push-tokens/{token}", { params: { path: { token } } }));
}

/** Stops pushes to this phone for the account (idempotent). */
export async function unregisterPushToken(token: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/me/push-tokens/{token}", { params: { path: { token } } }));
}

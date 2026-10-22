import { createApiClient, unwrap, type Schemas } from "@/api/client";
import { API_URL } from "@/config";
import { authedClient } from "@/features/auth/session";

// openapi-fetch URL-encodes path params itself: the raw token goes in (encoding it here would do it twice).

/** Registers this phone's Expo push token for the account (idempotent). */
export async function registerPushToken(token: string): Promise<void> {
  await unwrap((await authedClient()).PUT("/me/push-tokens/{token}", { params: { path: { token } } }));
}

/**
 * Stops pushes to this phone for the account (idempotent). `session` sends it with that session
 * instead of the saved one (the one the server just rejected, already cleared from the phone).
 */
export async function unregisterPushToken(token: string, session?: string): Promise<void> {
  const client = session ? createApiClient({ baseUrl: API_URL, token: session }) : await authedClient();
  await unwrap(client.DELETE("/me/push-tokens/{token}", { params: { path: { token } } }));
}

export type NotificationSettings = Schemas["NotificationSettings"];

/** Which pushes you get (every one is on by default). */
export async function fetchNotificationSettings(): Promise<NotificationSettings> {
  return (await unwrap((await authedClient()).GET("/me/settings"))).notifications;
}

/** Saves only the preferences given; returns all of them as the server left them. */
export async function updateNotificationSettings(patch: Partial<NotificationSettings>): Promise<NotificationSettings> {
  return (await unwrap((await authedClient()).PATCH("/me/settings", { body: { notifications: patch } }))).notifications;
}

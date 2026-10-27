import * as Notifications from "expo-notifications";
import { EAS_PROJECT_ID } from "@/config";
import { clearPushTokenRegistered, isPushTokenRegistered, markPushTokenRegistered } from "@/storage/push-registered";
import { getSessionToken } from "@/storage/session";
import { registerPushToken, unregisterPushToken } from "./actions";
import { pushPermission } from "./push-permission";

/** The token this phone last registered, so signing out can unregister it without asking Expo again. */
let registered: string | null = null;

async function currentToken(): Promise<string | null> {
  if ((await pushPermission()) !== "granted") return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID })).data;
}

/**
 * With permission, registers this phone's push token for the account. It can change, and the
 * account can too, so it's sent only when the token or the session differ from the last one
 * registered successfully (saved on the phone: a plain launch costs no request). Never asks for
 * permission and never throws: the dev build (free Apple account, no push entitlement) can't get a
 * token, and the app works the same without pushes.
 */
export async function syncPushToken(): Promise<void> {
  try {
    const token = await currentToken();
    if (!token) return;
    const session = await getSessionToken();
    if (!session) return;
    registered = token;
    if (await isPushTokenRegistered(token, session)) return;
    await registerPushToken(token);
    await markPushTokenRegistered(token, session);
  } catch {
    // No pushes for now; the next launch tries again.
  }
}

/**
 * Before signing out: this phone stops getting the account's pushes. Best effort, never throws.
 * `session` is the session to send it with when it's no longer the saved one (a 401 already closed it).
 */
export async function forgetPushToken(session?: string): Promise<void> {
  const known = registered;
  registered = null;
  try {
    await clearPushTokenRegistered();
    const token = known ?? (await currentToken());
    if (token) await unregisterPushToken(token, session);
  } catch {
    // The server drops dead tokens on its own, and the next account to register it takes it over.
  }
}

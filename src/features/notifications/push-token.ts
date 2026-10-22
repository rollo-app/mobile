import * as Notifications from "expo-notifications";
import { EAS_PROJECT_ID } from "@/config";
import { registerPushToken, unregisterPushToken } from "./actions";
import { pushPermission } from "./push-permission";

/** The token this phone last registered, so signing out can unregister it without asking Expo again. */
let registered: string | null = null;

async function currentToken(): Promise<string | null> {
  if ((await pushPermission()) !== "granted") return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID })).data;
}

/**
 * With permission, registers this phone's push token for the account (it can change, so it's sent
 * on every launch). Never asks for permission and never throws: the dev build (free Apple account,
 * no push entitlement) can't get a token, and the app works the same without pushes.
 */
export async function syncPushToken(): Promise<void> {
  try {
    const token = await currentToken();
    if (!token) return;
    await registerPushToken(token);
    registered = token;
  } catch {
    // No pushes for now; the next launch tries again.
  }
}

/** Before signing out: this phone stops getting the account's pushes. Best effort, never throws. */
export async function forgetPushToken(): Promise<void> {
  try {
    const token = registered ?? (await currentToken());
    registered = null;
    if (token) await unregisterPushToken(token);
  } catch {
    // The server drops dead tokens on its own, and the next account to register it takes it over.
  }
}

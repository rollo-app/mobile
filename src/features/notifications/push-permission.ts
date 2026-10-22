import * as Notifications from "expo-notifications";
import { hasSeenPushPrimer } from "@/storage/push-primer";

export type PushPermission = "granted" | "denied" | "undetermined";

/** The system's notification permission. If the native module fails it counts as denied: nothing gets asked. */
export async function pushPermission(): Promise<PushPermission> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return "granted";
    return current.canAskAgain ? "undetermined" : "denied";
  } catch {
    return "denied";
  }
}

/** Shows the system dialog; true if notifications ended up allowed. */
export async function requestPushPermission(): Promise<boolean> {
  try {
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Our own explanation goes once, and only if the system dialog was never shown. */
export async function shouldOfferPushPrimer(): Promise<boolean> {
  return (await pushPermission()) === "undetermined" && !(await hasSeenPushPrimer());
}

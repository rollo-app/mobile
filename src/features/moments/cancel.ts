import * as Notifications from "expo-notifications";

export const MOMENT_PREFIX = "moment.";

/** Cancels every scheduled `moment.*` notification, or only those of one trip. Never throws. */
export async function cancelMomentNotifications(tripId?: string): Promise<void> {
  try {
    const prefix = tripId ? `${MOMENT_PREFIX}${tripId}.` : MOMENT_PREFIX;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(prefix))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // Best effort: a stale notification is harmless, the next sync cleans it.
  }
}

import * as Notifications from "expo-notifications";

/**
 * Older builds scheduled a local "Se reveló" notification per roll (id `reveal.<tripId>`). The push
 * replaces it: cancel any left on the phone so the reveal isn't announced twice. Never throws.
 */
export async function cancelLegacyRevealNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const { identifier } of scheduled) {
      if (identifier.startsWith("reveal.")) await Notifications.cancelScheduledNotificationAsync(identifier);
    }
  } catch {
    // At worst an old reminder still shows once.
  }
}

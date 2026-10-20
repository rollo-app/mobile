import * as Notifications from "expo-notifications";

// Show the notification even if the app is open when the reveal happens.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

type RevealTrip = { id: string; name: string; revealAt: number; revealed: boolean };

/** One id per roll: scheduling again replaces the notification instead of duplicating it. */
export const revealNotificationId = (tripId: string) => `reveal.${tripId}`;

/**
 * Local notification for the moment the roll is revealed (no push: the phone knows `revealAt`).
 * Safe to call every time the detail loads; if the roll is already revealed it only cancels.
 */
export async function scheduleRevealNotification(trip: RevealTrip, now: number = Date.now()): Promise<void> {
  const identifier = revealNotificationId(trip.id);
  try {
    if (trip.revealed || trip.revealAt <= now) {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      return;
    }
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title: `Se reveló ${trip.name}`, body: "Entrá a ver las fotos de todos.", data: { tripId: trip.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trip.revealAt },
    });
  } catch {
    // The notification is a nicety: if it can't be scheduled the app works the same.
  }
}

/** Asks for permission once, at a moment that makes sense (after creating or joining a roll). */
export async function requestRevealPermission(): Promise<void> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || !current.canAskAgain) return;
    await Notifications.requestPermissionsAsync();
  } catch {
    // Without permission the roll still gets revealed; you just don't get the heads-up.
  }
}

/** The roll a tapped notification belongs to, or null. */
export function tripIdFromResponse(response: Notifications.NotificationResponse | null): string | null {
  const tripId = response?.notification.request.content.data?.tripId;
  return typeof tripId === "string" ? tripId : null;
}

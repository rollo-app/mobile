import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { currentMoment, type CurrentMoment } from "./current-moment";
import { momentNotificationId } from "./plan";

type Delivered = { identifier: string; data: Record<string, unknown> }[];

const reloaders = new Set<() => void>();

/** Clears a moment once it was sent: removes its delivered notification so the banner goes away right then. */
export async function momentTaken(tripId: string, day: string) {
  await Notifications.dismissNotificationAsync(momentNotificationId(tripId, day)).catch(() => undefined);
  for (const reload of reloaders) reload();
}

/**
 * The moment that fired and is still open, or null. Reads what iOS has delivered on mount and when the app
 * returns to foreground, and ticks every second while one is open so the countdown moves and the banner disappears.
 */
export function useCurrentMoment(): CurrentMoment | null {
  const [delivered, setDelivered] = useState<Delivered>([]);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(() => {
    void Notifications.getPresentedNotificationsAsync()
      .then((list) =>
        setDelivered(
          list
            .filter((n) => n.request.identifier.startsWith("moment."))
            .map((n) => ({ identifier: n.request.identifier, data: (n.request.content.data ?? {}) as Record<string, unknown> })),
        ),
      )
      .catch(() => undefined);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    load();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
    });
    // A moment that fires while the app is open on Rollo.
    const received = Notifications.addNotificationReceivedListener(load);
    reloaders.add(load);
    return () => {
      reloaders.delete(load);
      subscription.remove();
      received.remove();
    };
  }, [load]);

  const moment = currentMoment(delivered, now);
  const open = moment !== null;
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);

  return moment;
}

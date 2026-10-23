import * as Notifications from "expo-notifications";
import { router, usePathname, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { setActiveTripId } from "@/storage/active-trip";
import { notificationTarget } from "./notification-target";

// A push that arrives with the app open still shows as a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

/** Where the app still is on its way in ("/" redirects home, the rest is the login): a push waits until it lands. */
const LANDING = new Set(["/", "/email", "/code", "/profile"]);

/** Ids already opened, so the same tap (cold start + listener, or a remount) never navigates twice. */
const handled = new Set<string>();

/**
 * Tapping a push opens its `data.url`: from a closed app (the last response) or with the app running
 * (the listener). It waits for `accountReady` (signed in with a complete profile) and for the app to
 * land on its home: a tap while signed out opens once the login is done. A roll id in the url becomes the active roll first.
 */
export function useNotificationResponse(accountReady: boolean) {
  const pathname = usePathname();
  // Navigating before the first redirect home would get replaced by it.
  const ready = accountReady && !LANDING.has(pathname);
  const [pending, setPending] = useState<Notifications.NotificationResponse | null>(null);

  useEffect(() => {
    let active = true;
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (active && response) setPending(response);
      })
      .catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => setPending(response));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready || !pending) return;
    const id = pending.notification.request.identifier;
    setPending(null);
    if (handled.has(id)) return;
    handled.add(id);
    // So the next launch doesn't open it again.
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    const target = notificationTarget(pending);
    if (!target) return;
    void (async () => {
      if (target.tripId) await setActiveTripId(target.tripId);
      if (!target.tab) return router.push(target.href as Href);
      // A tab: close whatever is open on top (a sheet, the camera) and switch to it.
      if (router.canDismiss()) router.dismissAll();
      router.navigate(target.href as Href);
    })();
  }, [ready, pending]);
}

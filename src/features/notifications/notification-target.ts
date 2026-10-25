import type * as Notifications from "expo-notifications";

/**
 * Where a tapped push goes. The server sends an app path in `data.url` (`/roll?trip=…`, `/user/…`,
 * `/reveal?trip=…`, `/photo/…?tripId=…`, `/friends`). A roll id in `trip` (or the photo's `tripId`) becomes the
 * active roll first. The roll and the reveal open the roll's tab: an unseen reveal plays from there; a friend request opens the Amigos tab.
 */
export type NotificationTarget = { tripId: string | null; tab: boolean; href: string };

const TAB_PATHS: Record<string, string> = { "/roll": "/roll", "/reveal": "/roll", "/friends": "/friends" };

export function notificationTarget(response: Notifications.NotificationResponse | null): NotificationTarget | null {
  const url: unknown = response?.notification.request.content.data?.url;
  // Only paths inside the app: never another host.
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) return null;

  const [pathname = "/", query = ""] = url.split("?", 2);
  const params = new URLSearchParams(query);
  const tripId = params.get("trip") ?? params.get("tripId");
  const tab = TAB_PATHS[pathname];
  if (tab) return { tripId, tab: true, href: tab };

  params.delete("trip");
  const rest = params.toString();
  return { tripId, tab: false, href: rest ? `${pathname}?${rest}` : pathname };
}

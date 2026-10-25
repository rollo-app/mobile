import * as Notifications from "expo-notifications";
import { getSession } from "@/features/auth/session";
import { fetchMyTrips } from "@/features/trips/actions";
import { fetchMyMoments } from "./actions";
import { cancelMomentNotifications, MOMENT_PREFIX } from "./cancel";
import { serialized } from "./lock";
import { planMoments, tripsToSync, type PlannedMoment, type TripMoments } from "./plan";

export { cancelMomentNotifications };

/**
 * Moves the system's scheduled moment notifications to match the server. Never throws.
 * Serialized with every other sync and cancellation.
 */
export function syncMoments(): Promise<void> {
  return serialized(syncNow);
}

async function syncNow(): Promise<void> {
  try {
    const session = await getSession();
    if (!session) return;
    const { trips } = await fetchMyTrips();
    const now = Date.now();
    const ids = new Set(tripsToSync(trips, now));
    const wanted = trips.filter((t) => ids.has(t.id));

    const results = await Promise.allSettled(wanted.map((t) => fetchMyMoments(t.id)));
    // No trip answered at all (e.g. no signal): touch nothing.
    if (wanted.length > 0 && results.every((r) => r.status === "rejected")) return;

    const fetched: TripMoments[] = [];
    const failed = new Set<string>();
    wanted.forEach((t, i) => {
      const r = results[i]!;
      if (r.status === "fulfilled") fetched.push({ tripId: t.id, tripName: t.name, moments: r.value });
      else failed.add(t.id);
    });
    const planned = planMoments(fetched, now);
    const keep = new Set(planned.map((p) => p.id));

    // The session may have ended (or changed) while we were fetching: don't revive anything.
    if ((await getSession()) !== session) return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const stale = (id: string) =>
      id.startsWith(MOMENT_PREFIX) && !keep.has(id) && ![...failed].some((t) => id.startsWith(`${MOMENT_PREFIX}${t}.`));
    await Promise.all(
      scheduled.filter((n) => stale(n.identifier)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    // Same identifier replaces the previous one, so running this twice never duplicates.
    for (const p of planned) await schedule(p);
  } catch {
    // The next sync tries again; whatever is scheduled keeps working.
  }
}

async function schedule(p: PlannedMoment): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: p.id,
    content: {
      title: "Es tu momento",
      body: `Tenés 5 minutos para sacar tu foto de ${p.tripName}.`,
      data: { url: `/moment?trip=${p.tripId}&day=${p.day}&at=${p.notifyAt}` },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.notifyAt },
  });
}

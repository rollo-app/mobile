import * as Notifications from "expo-notifications";
import { getSession } from "@/features/auth/session";
import { fetchMyTrips } from "@/features/trips/actions";
import { fetchMyMoments } from "./actions";
import { cancelMomentNotifications, MOMENT_PREFIX } from "./cancel";
import { globalCancelledSince, isSuperseded, serialized, startSync, tripCancelledSince } from "./lock";
import { planMoments, tripsToSync, type MomentMode, type PlannedMoment, type TripMoments } from "./plan";

export { cancelMomentNotifications };

/**
 * Moves the system's scheduled moment notifications to match the server. Never throws.
 * The fetches run outside the lock (a hanging network never blocks a cancellation); only the
 * check-and-apply phase is serialized.
 */
export async function syncMoments(): Promise<void> {
  try {
    const stamp = startSync();
    const session = await getSession();
    if (!session) return;
    const { trips } = await fetchMyTrips();
    const now = Date.now();
    const ids = new Set(tripsToSync(trips, now));
    const wanted = trips.filter((t) => ids.has(t.id));

    const results = await Promise.allSettled(wanted.map((t) => fetchMyMoments(t.id)));
    // No trip answered at all (e.g. no signal): touch nothing.
    if (wanted.length > 0 && results.every((r) => r.status === "rejected")) return;

    await serialized(() => apply(stamp, session, wanted, results, now));
  } catch {
    // The next sync tries again; whatever is scheduled keeps working.
  }
}

async function apply(
  stamp: ReturnType<typeof startSync>,
  session: string,
  wanted: { id: string; name: string; momentMode?: MomentMode }[],
  results: PromiseSettledResult<{ day: string; notifyAt: number }[]>[],
  now: number,
): Promise<void> {
  try {
    // A newer sync is on its way, or the session/rollo was closed while we were fetching: don't revive anything.
    if (isSuperseded(stamp) || globalCancelledSince(stamp)) return;
    if ((await getSession()) !== session) return;

    const fetched: TripMoments[] = [];
    const failed = new Set<string>();
    wanted.forEach((t, i) => {
      const r = results[i]!;
      if (tripCancelledSince(stamp, t.id)) return;
      if (r.status === "fulfilled") fetched.push({ tripId: t.id, tripName: t.name, momentMode: t.momentMode, moments: r.value });
      else failed.add(t.id);
    });
    const planned = planMoments(fetched, now);
    const keep = new Set(planned.map((p) => p.id));

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const stale = (id: string) =>
      id.startsWith(MOMENT_PREFIX) && !keep.has(id) && ![...failed].some((t) => id.startsWith(`${MOMENT_PREFIX}${t}.`));
    await Promise.all(
      scheduled.filter((n) => stale(n.identifier)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    // Same identifier replaces the previous one, so running this twice never duplicates.
    for (const p of planned) await scheduleMomentNotification(p);
  } catch {
    // The next sync tries again; whatever is scheduled keeps working.
  }
}

/** Schedules one moment's local notification (the same identifier replaces the previous one). */
export async function scheduleMomentNotification(p: PlannedMoment): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: p.id,
    content: {
      title: "Es tu momento",
      body: `Tenés 15 minutos para sacar tu foto de ${p.tripName}.`,
      // The camera must not wait for the trip detail (no signal), so the mode travels in the url.
      data: { url: `/moment?trip=${p.tripId}&day=${p.day}&at=${p.notifyAt}${p.momentMode ? `&selfie=${p.momentMode === "photo_selfie" ? 1 : 0}` : ""}` },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.notifyAt },
  });
}

import * as Notifications from "expo-notifications";
import { fetchMyTrips } from "@/features/trips/actions";
import { fetchMyMoments } from "./actions";
import { cancelMomentNotifications, MOMENT_PREFIX } from "./cancel";
import { planMoments, tripsToSync, type PlannedMoment } from "./plan";

export { cancelMomentNotifications };

/** Moves the system's scheduled moment notifications to match the server. Never throws. */
export async function syncMoments(): Promise<void> {
  try {
    const { trips } = await fetchMyTrips();
    const now = Date.now();
    const ids = new Set(tripsToSync(trips, now));
    const wanted = trips.filter((t) => ids.has(t.id));
    // Any failure aborts before touching what's already scheduled (e.g. no signal).
    const fetched = await Promise.all(
      wanted.map(async (t) => ({ tripId: t.id, tripName: t.name, moments: await fetchMyMoments(t.id) })),
    );
    const planned = planMoments(fetched, now);
    const keep = new Set(planned.map((p) => p.id));

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(MOMENT_PREFIX) && !keep.has(n.identifier))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
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

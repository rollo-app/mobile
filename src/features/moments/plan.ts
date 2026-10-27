/** Pure planning of the daily-moment local notifications (no I/O). */

export const MOMENT_WINDOW_MS = 900_000;
export const MAX_SCHEDULED = 40;

export type MomentMode = "off" | "photo" | "photo_selfie";

export type TripMoments = { tripId: string; tripName: string; momentMode?: MomentMode; moments: { day: string; notifyAt: number }[] };
export type PlannedMoment = { id: string; tripId: string; tripName: string; momentMode?: MomentMode; day: string; notifyAt: number };

export const momentNotificationId = (tripId: string, day: string) => `moment.${tripId}.${day}`;

/** The future moments, soonest first, capped to what iOS lets us schedule. */
export function planMoments(trips: TripMoments[], now: number): PlannedMoment[] {
  return trips
    .flatMap((t) =>
      t.moments
        .filter((m) => m.notifyAt > now)
        .map((m) => ({ id: momentNotificationId(t.tripId, m.day), tripId: t.tripId, tripName: t.tripName, momentMode: t.momentMode, ...m })),
    )
    .sort((a, b) => a.notifyAt - b.notifyAt)
    .slice(0, MAX_SCHEDULED);
}

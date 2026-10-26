/** Local date (YYYY-MM-DD) of an instant in the trip's time zone. The server uses it for the quota. */
export function localDay(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

type Today = { date: string; photosLeft: number };

/**
 * What is left: what the server reported (today's photos in a daily rollo, the whole rollo's in a total one)
 * minus what was captured and is still in the queue.
 * `null` if we don't know (no signal or the data is from another day): capture is allowed and the server decides.
 */
export function remaining(today: Today | null, day: string, pending: { photos: number }): { photos: number } | null {
  if (!today || today.date !== day) return null;
  return { photos: Math.max(0, today.photosLeft - pending.photos) };
}

/**
 * Which day's pending photos count against the quota: only today's in a daily rollo, all of them
 * (`undefined`) in a total one. Details cached by an older build have no mode: they were daily.
 */
export function pendingDayFor(trip: { photoLimitMode?: "daily" | "total" }, day: string): string | undefined {
  return trip.photoLimitMode === "total" ? undefined : day;
}

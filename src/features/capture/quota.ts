/** Local date (YYYY-MM-DD) of an instant in the trip's time zone. The server uses it for the quota. */
export function localDay(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

type Today = { date: string; photosLeft: number; videosLeft: number };

/**
 * What is left today: what the server reported minus what was captured and is still in the queue.
 * `null` if we don't know (no signal or the data is from another day): capture is allowed and the server decides.
 */
export function remaining(
  today: Today | null,
  day: string,
  pending: { photos: number; videos: number },
): { photos: number; videos: number } | null {
  if (!today || today.date !== day) return null;
  return {
    photos: Math.max(0, today.photosLeft - pending.photos),
    videos: Math.max(0, today.videosLeft - pending.videos),
  };
}

/** Fecha local (YYYY-MM-DD) de un instante en la zona del viaje. Es la que usa el server para el cupo. */
export function localDay(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

type Today = { date: string; photosLeft: number; videosLeft: number };

/**
 * Lo que queda hoy: lo que informó el server menos lo sacado que sigue en la cola.
 * `null` si no sabemos (sin señal o el dato es de otro día): ahí se deja sacar y el server decide.
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

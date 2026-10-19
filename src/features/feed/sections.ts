import type { MapItem } from "@/features/map/features";

export type FeedSection = { day: string; title: string; data: MapItem[] };

const dayNumber = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86_400_000;
};

/** The local date (YYYY-MM-DD) of an instant in the trip's time zone. */
const localDay = (ms: number, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(ms);

/** "Hoy", "Ayer" or "Lunes 12", in the trip's time zone. */
export function dayTitle(day: string, timeZone: string, now: number = Date.now()): string {
  const diff = dayNumber(localDay(now, timeZone)) - dayNumber(day);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: "UTC" }).format(dayNumber(day) * 86_400_000);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${Number(day.slice(8, 10))}`;
}

/** Sections by `day`, newest to oldest; within each day also latest first. */
export function groupByDay(items: MapItem[], timeZone: string, now: number = Date.now()): FeedSection[] {
  const byDay = new Map<string, MapItem[]>();
  for (const i of items) byDay.set(i.day, [...(byDay.get(i.day) ?? []), i]);
  return [...byDay.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((day) => ({
      day,
      title: dayTitle(day, timeZone, now),
      data: byDay.get(day)!.sort((a, b) => b.takenAt - a.takenAt),
    }));
}

/** The `limit` most recent: the Feed shows in batches and asks for more on reaching the end. */
export function newest(items: MapItem[], limit: number): MapItem[] {
  return [...items].sort((a, b) => b.takenAt - a.takenAt).slice(0, limit);
}

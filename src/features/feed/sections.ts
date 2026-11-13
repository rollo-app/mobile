import type { MapItem } from "@/features/map/features";
import { dateFormatter } from "@/lib/intl";

export type FeedSection = { day: string; title: string; data: MapItem[] };

const dayNumber = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86_400_000;
};

/** The local date (YYYY-MM-DD) of an instant in the trip's time zone. */
const localDay = (ms: number, timeZone: string) => dateFormatter("en-CA", { timeZone }).format(ms);

/** "Hoy", "Ayer" or "Lunes 12", in the trip's time zone. */
export function dayTitle(day: string, timeZone: string, now: number = Date.now()): string {
  const diff = dayNumber(localDay(now, timeZone)) - dayNumber(day);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  const weekday = dateFormatter("es-AR", { weekday: "long", timeZone: "UTC" }).format(dayNumber(day) * 86_400_000);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${Number(day.slice(8, 10))}`;
}

/** Sections by `day`, newest to oldest; within each day also latest first. */
export function groupByDay(items: MapItem[], timeZone: string, now: number = Date.now()): FeedSection[] {
  const byDay = new Map<string, MapItem[]>();
  for (const i of items) {
    const list = byDay.get(i.day);
    if (list) list.push(i);
    else byDay.set(i.day, [i]);
  }
  return [...byDay.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((day) => ({
      day,
      title: dayTitle(day, timeZone, now),
      data: byDay.get(day)!.sort((a, b) => b.takenAt - a.takenAt),
    }));
}

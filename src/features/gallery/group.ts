import type { RevealedPhoto } from "@/features/media/revealed";

export type DaySection = { day: string; title: string; photos: RevealedPhoto[] };

/** "2027-01-12" → "Martes 12 de enero". The server's `day` is already in the roll's zone, so UTC avoids shifting it. */
export function dayTitle(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const text = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })
    .format(Date.UTC(year!, month! - 1, date!))
    .replace(",", "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** One section per day, in the order the photos come in. */
export function groupByDay(photos: RevealedPhoto[]): DaySection[] {
  const sections: DaySection[] = [];
  for (const photo of photos) {
    const last = sections[sections.length - 1];
    if (last && last.day === photo.day) last.photos.push(photo);
    else sections.push({ day: photo.day, title: dayTitle(photo.day), photos: [photo] });
  }
  return sections;
}

export function filterByAuthor(photos: RevealedPhoto[], authorId: string | null): RevealedPhoto[] {
  return authorId === null ? photos : photos.filter((p) => p.author.id === authorId);
}

export function authorsOf(photos: RevealedPhoto[]): { id: string; name: string }[] {
  const seen = new Map<string, { id: string; name: string }>();
  for (const p of photos) if (!seen.has(p.author.id)) seen.set(p.author.id, p.author);
  return [...seen.values()];
}

export function chunkRows<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

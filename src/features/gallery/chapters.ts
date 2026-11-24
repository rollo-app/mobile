import type { RevealedPhoto } from "@/features/media/revealed";
import { dateFormatter } from "@/lib/intl";
import { dayTitle } from "./group";

export type Chapter = {
  key: string;
  kicker: string | null;
  title: string;
  photos: RevealedPhoto[];
  placeable: boolean;
};

export type ChapterContext =
  | { kind: "trip"; startDay: string }
  | {
      kind: "event";
      groups: { id: string; name: string }[];
      showGroupTitle: boolean;
      timeZone: string;
      multiDay: boolean;
    };

/** A group with more photos than this is split into 2-hour blocks. */
export const SPLIT_THRESHOLD = 40;

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Math.round(Date.UTC(year!, month! - 1, date!) / DAY_MS);
}

function hourIn(takenAt: number, timeZone: string): number {
  const hour = Number(dateFormatter("es-AR", { timeZone, hour: "numeric", hourCycle: "h23" }).format(takenAt));
  return hour % 24;
}

function blockStartOf(takenAt: number, timeZone: string): number {
  return Math.floor(hourIn(takenAt, timeZone) / 2) * 2;
}

function blockLabel(blockStart: number): string {
  return `de ${blockStart} a ${(blockStart + 2) % 24} h`;
}

/** "De 20 a 22 h", or "Sábado · de 20 a 22 h" with the weekday (in the given zone). */
export function timeBlockTitle(takenAt: number, timeZone: string, withDay: boolean): string {
  const label = blockLabel(blockStartOf(takenAt, timeZone));
  if (!withDay) return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  const weekday = dateFormatter("es-AR", { timeZone, weekday: "long" }).format(takenAt);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${label}`;
}

function tripChapters(photos: RevealedPhoto[], startDay: string): Chapter[] {
  const chapters: Chapter[] = [];
  const byDay = new Map<string, Chapter>();
  const start = dayNumber(startDay);
  for (const photo of photos) {
    let chapter = byDay.get(photo.day);
    if (!chapter) {
      chapter = {
        key: `trip:${photo.day}`,
        kicker: `DÍA ${dayNumber(photo.day) - start + 1}`,
        title: dayTitle(photo.day),
        photos: [],
        placeable: true,
      };
      byDay.set(photo.day, chapter);
      chapters.push(chapter);
    }
    chapter.photos.push(photo);
  }
  return chapters;
}

function splitByBlocks(
  group: { id: string; name: string },
  photos: RevealedPhoto[],
  ctx: Extract<ChapterContext, { kind: "event" }>,
): Chapter[] {
  const chapters = new Map<string, Chapter>();
  for (const photo of photos) {
    const blockStart = blockStartOf(photo.takenAt, ctx.timeZone);
    const key = `group:${group.id}:${photo.day}:${blockStart}`;
    let chapter = chapters.get(key);
    if (!chapter) {
      chapter = {
        key,
        kicker: ctx.showGroupTitle ? group.name.toUpperCase() : null,
        title: timeBlockTitle(photo.takenAt, ctx.timeZone, ctx.multiDay),
        photos: [],
        placeable: false,
      };
      chapters.set(key, chapter);
    }
    chapter.photos.push(photo);
  }
  return [...chapters.values()];
}

function eventChapters(photos: RevealedPhoto[], ctx: Extract<ChapterContext, { kind: "event" }>): Chapter[] {
  const order = new Map(ctx.groups.map((group, index) => [group.id, index]));
  const perGroup = new Map<string, RevealedPhoto[]>();
  const others: RevealedPhoto[] = [];
  for (const photo of photos) {
    let first: string | null = null;
    let firstIndex = Infinity;
    for (const id of photo.groupIds) {
      const index = order.get(id);
      if (index !== undefined && index < firstIndex) {
        first = id;
        firstIndex = index;
      }
    }
    if (first === null) {
      others.push(photo);
      continue;
    }
    const list = perGroup.get(first);
    if (list) list.push(photo);
    else perGroup.set(first, [photo]);
  }

  const chapters: Chapter[] = [];
  for (const group of ctx.groups) {
    const list = perGroup.get(group.id);
    if (!list || list.length === 0) continue;
    if (list.length > SPLIT_THRESHOLD) {
      chapters.push(...splitByBlocks(group, list, ctx));
    } else {
      chapters.push({
        key: `group:${group.id}`,
        kicker: ctx.showGroupTitle ? "GRUPO" : null,
        title: ctx.showGroupTitle ? group.name : dayTitle(list[0]!.day),
        photos: list,
        placeable: false,
      });
    }
  }
  if (others.length > 0) {
    chapters.push({ key: "others", kicker: null, title: "Otras fotos", photos: others, placeable: false });
  }
  return chapters;
}

/** The diary's chapters: one per day in a trip; per group (split by 2-hour blocks when big) in an event. */
export function buildChapters(photos: RevealedPhoto[], ctx: ChapterContext): Chapter[] {
  return ctx.kind === "trip" ? tripChapters(photos, ctx.startDay) : eventChapters(photos, ctx);
}

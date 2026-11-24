import type { RevealedPhoto } from "@/features/media/revealed";
import { groupByDay } from "./group";
import type { Chapter } from "./chapters";
import { pickHero, pickQuotes } from "./chapter-picks";

export type DayGridItem =
  | { kind: "header"; key: string; title: string }
  | { kind: "photo"; key: string; photo: RevealedPhoto; column: number };

/** The gallery as one flat list for a virtualized grid: a header per day followed by that day's photos, each tagged with its column. */
export function gridItems(photos: RevealedPhoto[], columns: number): DayGridItem[] {
  const items: DayGridItem[] = [];
  for (const section of groupByDay(photos)) {
    items.push({ kind: "header", key: `header:${section.day}`, title: section.title });
    // Each header spans the full width, so the first photo after it starts a new row.
    section.photos.forEach((photo, n) => items.push({ kind: "photo", key: `photo:${photo.id}`, photo, column: n % columns }));
  }
  return items;
}

export type GridItem =
  | { kind: "chapter"; key: string; chapter: Chapter }
  | { kind: "hero"; key: string; photo: RevealedPhoto }
  | { kind: "quote"; key: string; photo: RevealedPhoto }
  | { kind: "photo"; key: string; photo: RevealedPhoto; column: number };

/** The diary as one flat list: per chapter a header, its hero, then the photos with up to two full-width quotes between rows. */
export function diaryItems(chapters: Chapter[], columns: number): GridItem[] {
  const items: GridItem[] = [];
  for (const chapter of chapters) {
    items.push({ kind: "chapter", key: `chapter:${chapter.key}`, chapter });
    const hero = pickHero(chapter.photos);
    if (hero) items.push({ kind: "hero", key: `hero:${hero.id}`, photo: hero });
    const grid = hero ? chapter.photos.filter((p) => p.id !== hero.id) : chapter.photos;
    const quotes = pickQuotes(chapter.photos);

    // Positions are counts of photos placed before the quote; a quote with no room goes after the last photo.
    const first = Math.min(columns, grid.length);
    const middleRowEnd = (Math.floor(Math.floor(grid.length / 2) / columns) + 1) * columns;
    const second = middleRowEnd >= first + columns ? Math.min(middleRowEnd, grid.length) : grid.length;
    const at = [first, second];

    let column = 0;
    const pushQuotesAt = (count: number) => {
      quotes.forEach((q, n) => {
        if (at[n] === count) {
          items.push({ kind: "quote", key: `quote:${q.id}`, photo: q });
          column = 0;
        }
      });
    };
    grid.forEach((photo, n) => {
      items.push({ kind: "photo", key: `photo:${photo.id}`, photo, column });
      column = (column + 1) % columns;
      pushQuotesAt(n + 1);
    });
  }
  return items;
}

import type { RevealedPhoto } from "@/features/media/revealed";
import type { Chapter } from "./chapters";
import { pickHero, pickQuotes } from "./chapter-picks";

export type GridItem =
  | { kind: "chapter"; key: string; chapter: Chapter }
  | { kind: "hero"; key: string; photo: RevealedPhoto }
  | { kind: "quote"; key: string; photo: RevealedPhoto; side: "left" | "right" }
  | { kind: "photo"; key: string; photo: RevealedPhoto; column: number };

/** Where each quote row goes: after this many regular photos (a whole number of rows, or all of them). */
function quoteSlots(grid: RevealedPhoto[], quotes: RevealedPhoto[], columns: number): { photo: RevealedPhoto; after: number }[] {
  const slotsFor = (accepted: RevealedPhoto[]) => {
    const acceptedIds = new Set(accepted.map((q) => q.id));
    const regular = grid.length - accepted.length;
    let before = 0;
    const slots: { photo: RevealedPhoto; after: number }[] = [];
    for (const p of grid) {
      if (!acceptedIds.has(p.id)) before++;
      else slots.push({ photo: p, after: Math.min(Math.ceil(before / columns) * columns, regular) });
    }
    return slots;
  };
  const both = slotsFor(quotes);
  // Two quote rows are never adjacent: the later one goes back to the regular grid.
  return both.length === 2 && both[0]!.after === both[1]!.after ? slotsFor([quotes[0]!]) : both;
}

/** The diary as one flat list: per chapter a header, its hero, then rows of photos; each quoted photo (up to two) leaves the grid and gets a row of its own (photo + caption) at its natural place snapped to a row boundary. */
export function diaryItems(chapters: Chapter[], columns: number): GridItem[] {
  const items: GridItem[] = [];
  // Quote rows alternate sides across the whole list (a chapter without quotes takes no turn).
  let quoteCount = 0;
  for (const chapter of chapters) {
    items.push({ kind: "chapter", key: `chapter:${chapter.key}`, chapter });
    const hero = pickHero(chapter.photos);
    if (hero) items.push({ kind: "hero", key: `hero:${hero.id}`, photo: hero });
    // The hero wins: its photo is never a quote.
    const grid = hero ? chapter.photos.filter((p) => p.id !== hero.id) : chapter.photos;
    const slots = quoteSlots(grid, pickQuotes(grid), columns);
    const quoted = new Set(slots.map((s) => s.photo.id));
    const regular = grid.filter((p) => !quoted.has(p.id));

    let next = 0;
    const pushQuotesAt = (count: number) => {
      while (next < slots.length && slots[next]!.after === count) {
        const { photo } = slots[next++]!;
        items.push({ kind: "quote", key: `quote:${photo.id}`, photo, side: quoteCount++ % 2 === 0 ? "left" : "right" });
      }
    };
    pushQuotesAt(0);
    regular.forEach((photo, n) => {
      items.push({ kind: "photo", key: `photo:${photo.id}`, photo, column: n % columns });
      pushQuotesAt(n + 1);
    });
  }
  return items;
}

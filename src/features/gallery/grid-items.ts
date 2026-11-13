import type { RevealedPhoto } from "@/features/media/revealed";
import { groupByDay } from "./group";

export type GridItem =
  | { kind: "header"; key: string; title: string }
  | { kind: "photo"; key: string; photo: RevealedPhoto; column: number };

/** The gallery as one flat list for a virtualized grid: a header per day followed by that day's photos, each tagged with its column. */
export function gridItems(photos: RevealedPhoto[], columns: number): GridItem[] {
  const items: GridItem[] = [];
  for (const section of groupByDay(photos)) {
    items.push({ kind: "header", key: `header:${section.day}`, title: section.title });
    // Each header spans the full width, so the first photo after it starts a new row.
    section.photos.forEach((photo, n) => items.push({ kind: "photo", key: `photo:${photo.id}`, photo, column: n % columns }));
  }
  return items;
}

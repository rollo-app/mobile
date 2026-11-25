import { useSyncExternalStore } from "react";
import type { RevealedPhoto } from "@/features/media/revealed";
import { COLLAGE_MAX, pickCollage } from "./collage";

/** Adds or removes `id` from the ordered selection; removing renumbers the rest, and a full list is returned unchanged with `full: true`. */
export function toggleSelection(selection: readonly string[], id: string, max = COLLAGE_MAX): { selection: string[]; full: boolean } {
  if (selection.includes(id)) return { selection: selection.filter((s) => s !== id), full: false };
  if (selection.length >= max) return { selection: [...selection], full: true };
  return { selection: [...selection, id], full: false };
}

/** The selected candidates in selection order (the first is the hero); a random pick when none of the selection is usable. */
export function collagePhotos(candidates: RevealedPhoto[], selection: readonly string[], seed: number): RevealedPhoto[] {
  const byId = new Map(candidates.map((p) => [p.id, p]));
  const chosen = selection.flatMap((id) => byId.get(id) ?? []);
  return chosen.length > 0 ? chosen : pickCollage(candidates, seed);
}

const NONE: readonly string[] = [];
const selections = new Map<string, readonly string[]>();
const listeners = new Set<() => void>();

/** The chosen collage photo ids for a trip (in memory, lost when the app closes). */
export function getCollageSelection(tripId: string): readonly string[] {
  return selections.get(tripId) ?? NONE;
}

export function setCollageSelection(tripId: string, ids: readonly string[]): void {
  if (ids.length === 0) selections.delete(tripId);
  else selections.set(tripId, [...ids]);
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useCollageSelection(tripId: string): readonly string[] {
  return useSyncExternalStore(subscribe, () => getCollageSelection(tripId));
}

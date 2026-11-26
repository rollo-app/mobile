import { useSyncExternalStore } from "react";

const NONE: readonly string[] = [];
const selections = new Map<string, readonly string[]>();
const listeners = new Set<() => void>();

/** The chosen film photo ids for a trip (in memory, lost when the app closes; kept apart from the collage's selection). */
export function getFilmSelection(tripId: string): readonly string[] {
  return selections.get(tripId) ?? NONE;
}

export function setFilmSelection(tripId: string, ids: readonly string[]): void {
  if (ids.length === 0) selections.delete(tripId);
  else selections.set(tripId, [...ids]);
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

const shown = new Map<string, readonly string[]>();

/** The photo ids the film shows right now (set when the picker opens, so it starts from what the film is made of). */
export function getFilmShown(tripId: string): readonly string[] {
  return shown.get(tripId) ?? NONE;
}

export function setFilmShown(tripId: string, ids: readonly string[]): void {
  shown.set(tripId, [...ids]);
}

export function useFilmSelection(tripId: string): readonly string[] {
  return useSyncExternalStore(subscribe, () => getFilmSelection(tripId));
}

import { useSyncExternalStore } from "react";
import type { SheetChoices } from "@/features/journey/sheet/sheet-photos";

const NONE: SheetChoices = Object.freeze({});
const choices = new Map<string, SheetChoices>();
const listeners = new Set<() => void>();

/** What the person changed by hand in the summary film of a trip (in memory, lost when the app closes; kept apart from the collage's and the route film's). */
export function getSheetChoices(tripId: string): SheetChoices {
  return choices.get(tripId) ?? NONE;
}

export function setSheetChoices(tripId: string, next: SheetChoices): void {
  if (Object.keys(next).length === 0) choices.delete(tripId);
  else choices.set(tripId, { ...next });
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useSheetChoices(tripId: string): SheetChoices {
  return useSyncExternalStore(subscribe, () => getSheetChoices(tripId));
}

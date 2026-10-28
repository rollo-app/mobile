import type { TripSummary } from "./active";

export type RowActionId = "archive" | "unarchive" | "leave";

export const ROW_ACTION_TITLES: Record<RowActionId, string> = { archive: "Archivar", unarchive: "Desarchivar", leave: "Eliminar" };

/** What a row of "Tus rollos" offers: archiving only once revealed, leaving only if you didn't create it. */
export function rowActions(trip: TripSummary): RowActionId[] {
  return [
    ...(trip.revealed ? [trip.archived ? ("unarchive" as const) : ("archive" as const)] : []),
    ...(trip.isCreator ? [] : ["leave" as const]),
  ];
}

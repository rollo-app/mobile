import type { TripSummary } from "./active";

export type RowActionId = "share" | "archive" | "unarchive" | "leave";

export const ROW_ACTION_TITLES: Record<RowActionId, string> = { share: "Compartir", archive: "Archivar", unarchive: "Desarchivar", leave: "Eliminar" };

/**
 * What a row of the Rollos list offers: sharing always (the share screen says when a full or private roll can't), archiving only
 * once revealed, leaving only if you didn't create it.
 */
export function rowActions(trip: TripSummary): RowActionId[] {
  return [
    "share",
    ...(trip.revealed ? [trip.archived ? ("unarchive" as const) : ("archive" as const)] : []),
    ...(trip.isCreator ? [] : ["leave" as const]),
  ];
}

/** What sharing a roll from the list opens: the collage once revealed, the invitation before. */
export const listShareKind = (trip: TripSummary): "collage" | "invite" => (trip.revealed ? "collage" : "invite");

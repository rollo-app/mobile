import type { TripSummary } from "./active";

export type TripGroups = {
  /** Live, upcoming and ended-but-unrevealed rolls, in the server's order. */
  top: TripSummary[];
  /** Revealed within the last 3 months, newest reveal first. */
  revealed: TripSummary[];
  /** Revealed more than 3 months ago, newest reveal first. */
  older: TripSummary[];
  /** The active roll is among the old ones, so the group starts open. */
  olderExpandedByDefault: boolean;
};

/** Splits the list of "Tus rollos" into sections at `now`. Exactly 3 months ago still counts as recent. */
export function groupTrips(trips: TripSummary[], now: number, activeId: string | null): TripGroups {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
  const limit = cutoff.getTime();

  const top: TripSummary[] = [];
  const revealed: TripSummary[] = [];
  const older: TripSummary[] = [];
  for (const t of trips) {
    if (!t.revealed) top.push(t);
    else if (t.revealAt >= limit) revealed.push(t);
    else older.push(t);
  }
  const newestFirst = (a: TripSummary, b: TripSummary) => b.revealAt - a.revealAt;
  revealed.sort(newestFirst);
  older.sort(newestFirst);
  return { top, revealed, older, olderExpandedByDefault: older.some((t) => t.id === activeId) };
}

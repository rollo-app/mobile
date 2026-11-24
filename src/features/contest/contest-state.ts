import type { Schemas } from "@/api/client";
import type { RollPhase } from "@/features/trips/phase";

/** The most finalists an event can have. */
export const MAX_FINALISTS = 10;

/** "4 de 10". */
export const pickCountLabel = (n: number) => `${n} de ${MAX_FINALISTS}`;

/** Organizers choose the finalists while the contest is in `selecting` (from the end of the event to the reveal). */
export function canPick(contest: Pick<Schemas["Contest"], "status"> | null | undefined, isOrganizer: boolean): boolean {
  return isOrganizer && contest?.status === "selecting";
}

/** The board's "Elegí las finalistas" row: an organizer of an event with a contest, once it ended and until the reveal. */
export function picksRowVisible({ organizer, contestEnabled, phase }: { organizer: boolean; contestEnabled: boolean; phase: RollPhase | null }): boolean {
  return organizer && contestEnabled && phase === "ended";
}

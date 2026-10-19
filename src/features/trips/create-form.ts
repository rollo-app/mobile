const HOUR = 60 * 60 * 1000;

export type RollDraft = {
  name: string;
  adminName: string;
  startsAt: number;
  endsAt: number;
  revealAt: number;
};

export type RollValidation = { valid: boolean; startError?: string; endError?: string; revealError?: string };

/** The start picker only has minute granularity, so a start this close to now still counts as current. */
const PAST_TOLERANCE = 5 * 60 * 1000;

/** The next full hour after `now`. */
export function defaultStart(now: number): number {
  return (Math.floor(now / HOUR) + 1) * HOUR;
}

export function validateRoll(draft: RollDraft, now: number): RollValidation {
  const startError = draft.startsAt >= now - PAST_TOLERANCE ? undefined : "El inicio no puede ser en el pasado";
  const endError = draft.endsAt > draft.startsAt ? undefined : "El fin tiene que ser después del inicio";
  const revealError = draft.revealAt >= draft.endsAt ? undefined : "El revelado no puede ser antes del fin";
  const valid = draft.name.trim().length > 0 && draft.adminName.trim().length > 0 && !startError && !endError && !revealError;
  return { valid, ...(startError && { startError }), ...(endError && { endError }), ...(revealError && { revealError }) };
}

/** Moves the start; if it lands at or after the end, the end follows keeping the duration (or 1 hour). */
export function moveStart(dates: { startsAt: number; endsAt: number }, startsAt: number) {
  if (startsAt < dates.endsAt) return { startsAt, endsAt: dates.endsAt };
  const duration = dates.endsAt - dates.startsAt;
  return { startsAt, endsAt: startsAt + (duration > 0 ? duration : HOUR) };
}

/** A custom reveal can't be before the end: if it is, it goes to the end and `moved` says so. */
export function fitReveal(revealAt: number, endsAt: number) {
  return revealAt >= endsAt ? { revealAt, moved: false } : { revealAt: endsAt, moved: true };
}

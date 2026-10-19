const HOUR = 60 * 60 * 1000;

export type RollDraft = {
  name: string;
  adminName: string;
  startsAt: number;
  endsAt: number;
  revealAt: number;
};

export type RollValidation = { valid: boolean; endError?: string; revealError?: string };

/** The next full hour after `now`. */
export function defaultStart(now: number): number {
  return (Math.floor(now / HOUR) + 1) * HOUR;
}

export function validateRoll(draft: RollDraft): RollValidation {
  const endError = draft.endsAt > draft.startsAt ? undefined : "El fin tiene que ser después del inicio";
  const revealError = draft.revealAt >= draft.endsAt ? undefined : "El revelado no puede ser antes del fin";
  const valid = draft.name.trim().length > 0 && draft.adminName.trim().length > 0 && !endError && !revealError;
  return { valid, ...(endError && { endError }), ...(revealError && { revealError }) };
}

const HOUR = 60 * 60 * 1000;

/** The next full hour after `now`. */
export function defaultStart(now: number): number {
  return (Math.floor(now / HOUR) + 1) * HOUR;
}

/** Only the name is checked here: the server validates the dates and answers with the reason. */
export function canCreate(name: string): boolean {
  return name.trim().length > 0;
}

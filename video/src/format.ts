const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

function wall(iso: string) {
  const m = WALL.exec(iso);
  if (!m) throw new Error(`Fecha inválida: ${iso}`);
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]), h: m[4]!, mi: m[5]! };
}

/** "12:04" — the clock of the ISO string's own offset, never the machine's zone. */
export function formatHour(takenAt: string): string {
  const { h, mi } = wall(takenAt);
  return `${h}:${mi}`;
}

/** "20 jul 2026" */
export function formatRevealDate(iso: string): string {
  const { y, mo, d } = wall(iso);
  return `${d} ${MONTHS[mo - 1]} ${y}`;
}

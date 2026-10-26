const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "ahora", "hace 5 min", "hace 2 h", "hace 3 d" and, after a week, the date ("2 ene"). */
export function formatAgo(timestamp: number, now: number = Date.now()): string {
  const elapsed = now - timestamp;
  if (elapsed < MINUTE) return "ahora";
  if (elapsed < HOUR) return `hace ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `hace ${Math.floor(elapsed / HOUR)} h`;
  if (elapsed < 7 * DAY) return `hace ${Math.floor(elapsed / DAY)} d`;
  const date = new Date(timestamp);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

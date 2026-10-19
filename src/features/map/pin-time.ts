/** Hora relativa de una foto en la zona del viaje: "hoy 13:10", "ayer 21:40", "lun 12 · 13:10". */

function parts(ms: number, timeZone: string) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("es-AR", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ms)) {
    out[p.type] = p.value;
  }
  return out;
}

const dayNumber = (p: Record<string, string>) => Date.UTC(+p.year!, +p.month! - 1, +p.day!) / 86_400_000;

export function formatPinTime(takenAt: number, timeZone: string, now: number = Date.now()): string {
  const p = parts(takenAt, timeZone);
  const time = `${p.hour}:${p.minute}`;
  const diff = dayNumber(parts(now, timeZone)) - dayNumber(p);
  if (diff === 0) return `hoy ${time}`;
  if (diff === 1) return `ayer ${time}`;
  return `${p.weekday!.replace(".", "")} ${+p.day!} · ${time}`;
}

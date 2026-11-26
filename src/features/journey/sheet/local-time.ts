// The local clock of a photo in the roll's own time zone. Pure. One formatter per instant: a daylight-saving change
// inside the roll must not shift the hours, so there is never a single UTC offset for the whole roll.
import { localDay } from "@/features/capture/quota";
import { dateFormatter } from "@/lib/intl";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minutes since local midnight (0-1439) of an instant, in `timeZone`. */
export function localMinutes(ms: number, timeZone: string): number {
  const parts = dateFormatter("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
  const [h, m] = parts.split(":");
  return (Number(h) % 24) * 60 + Number(m);
}

/** Local minutes and 1-based local day number (counted from the earliest instant's local day) of each instant. */
export function localClocks(times: number[], timeZone: string): { localMinutes: number; day: number }[] {
  if (times.length === 0) return [];
  const days = times.map((t) => Date.parse(localDay(t, timeZone)));
  const first = Math.min(...days);
  return times.map((t, i) => ({ localMinutes: localMinutes(t, timeZone), day: Math.round((days[i]! - first) / DAY_MS) + 1 }));
}

import { momentState } from "./moment-time";

export type CurrentMoment = { tripId: string; day: string; at: number; leftMs: number };

const PREFIX = "moment.";

/**
 * The delivered `moment.<tripId>.<day>` notification whose window is still open (the latest one if several).
 * The notification time comes from the `at` param of its url: a moment that has not fired is never delivered, so nothing leaks.
 */
export function currentMoment(
  delivered: { identifier: string; data: Record<string, unknown> }[],
  now: number,
): CurrentMoment | null {
  let best: CurrentMoment | null = null;
  for (const { identifier, data } of delivered) {
    if (!identifier.startsWith(PREFIX)) continue;
    const lastDot = identifier.lastIndexOf(".");
    const tripId = identifier.slice(PREFIX.length, lastDot);
    const day = identifier.slice(lastDot + 1);
    const url = data?.url;
    if (!tripId || lastDot <= PREFIX.length || !day || typeof url !== "string") continue;
    const raw = new URLSearchParams(url.split("?", 2)[1] ?? "").get("at");
    const at = raw == null || raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(at)) continue;
    const state = momentState(at, now);
    if (state.kind !== "open") continue;
    if (!best || at > best.at) best = { tripId, day, at, leftMs: state.leftMs };
  }
  return best;
}

import { MOMENT_WINDOW_MS } from "./plan";

export type MomentState = { kind: "open"; leftMs: number } | { kind: "late" };

/** Whether the 5-minute window that starts at `at` (the notification time) is still open at `now`. */
export function momentState(at: number, now: number): MomentState {
  const leftMs = at + MOMENT_WINDOW_MS - now;
  return leftMs >= 0 ? { kind: "open", leftMs } : { kind: "late" };
}

/** "3:12": minutes and padded seconds, partial seconds rounded up. */
export function formatLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

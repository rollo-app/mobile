export const RESEND_WAIT_S = 60;

/** Seconds left before "Reenviar código" is enabled again (0 = enabled). */
export function resendSecondsLeft(sentAt: number, now: number, waitS: number = RESEND_WAIT_S): number {
  return Math.max(0, Math.ceil((sentAt + waitS * 1000 - now) / 1000));
}

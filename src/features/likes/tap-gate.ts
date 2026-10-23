/** How long a first tap waits for a second one before it counts as a single tap. */
export const DOUBLE_TAP_MS = 250;

/**
 * Tells single from double taps: a tap waits `delayMs` before `onSingle` runs; a second tap inside
 * that window cancels it and runs `onDouble` instead (with the second tap's payload).
 */
export function createTapGate<T>({
  onSingle,
  onDouble,
  delayMs = DOUBLE_TAP_MS,
}: {
  onSingle: (payload: T) => void;
  onDouble: (payload: T) => void;
  delayMs?: number;
}) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    tap(payload: T) {
      if (timer) {
        cancel();
        onDouble(payload);
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        onSingle(payload);
      }, delayMs);
    },
    cancel,
  };
}

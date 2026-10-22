import { useEffect, useRef } from "react";
import { createTapGate, DOUBLE_TAP_MS } from "./tap-gate";

/**
 * A tap handler that tells single from double taps (see `createTapGate`). The latest callbacks are
 * used; a pending single tap is dropped on unmount.
 */
export function useDoubleTap<T = void>(onSingle: (payload: T) => void, onDouble: (payload: T) => void, delayMs = DOUBLE_TAP_MS) {
  const single = useRef(onSingle);
  const double = useRef(onDouble);
  single.current = onSingle;
  double.current = onDouble;
  const gate = useRef<ReturnType<typeof createTapGate<T>> | null>(null);
  if (!gate.current)
    gate.current = createTapGate<T>({ onSingle: (p) => single.current(p), onDouble: (p) => double.current(p), delayMs });
  useEffect(() => () => gate.current?.cancel(), []);
  return gate.current;
}

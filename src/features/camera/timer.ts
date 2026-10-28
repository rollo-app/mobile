/** The self-timer, like the iPhone's camera: apagado → 3 s → 10 s. */
export type TimerDelay = 0 | 3 | 10;

export function nextTimer(delay: TimerDelay): TimerDelay {
  return delay === 0 ? 3 : delay === 3 ? 10 : 0;
}

export function timerLabel(delay: TimerDelay): string {
  return delay === 0 ? "Temporizador: apagado" : `Temporizador: ${delay} segundos`;
}

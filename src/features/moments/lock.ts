/**
 * One chain for everything that touches the scheduled moment notifications (syncs from the app
 * opening, foreground and the background task, plus cancellations), so they never interleave.
 * Lives apart from cancel.ts and moment-sync.ts so both can use it without an import cycle.
 */
let tail: Promise<unknown> = Promise.resolve();

export function serialized<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job, job);
  tail = run.catch(() => {});
  return run;
}

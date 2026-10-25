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

/**
 * Cancellations never wait for the network: they bump an epoch synchronously and then only queue
 * behind the short "apply" phase of a sync. A sync captures the epochs before its fetches and
 * drops what they invalidated when it applies.
 */
let globalEpoch = 0;
const tripEpochs = new Map<string, number>();
let syncSeq = 0;

export const bumpEpoch = (tripId?: string) => {
  if (tripId) tripEpochs.set(tripId, (tripEpochs.get(tripId) ?? 0) + 1);
  else globalEpoch++;
};

export const startSync = () => ({ seq: ++syncSeq, global: globalEpoch, trips: new Map(tripEpochs) });
export type SyncStamp = ReturnType<typeof startSync>;

export const isSuperseded = (s: SyncStamp) => s.seq !== syncSeq;
export const globalCancelledSince = (s: SyncStamp) => s.global !== globalEpoch;
export const tripCancelledSince = (s: SyncStamp, tripId: string) =>
  (s.trips.get(tripId) ?? 0) !== (tripEpochs.get(tripId) ?? 0);

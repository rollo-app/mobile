import type { VideoFile, VideoOptions } from "../../../modules/rollo-video";

/** How long a slice of frames may run before the UI gets a turn. */
export const SLICE_MS = 40;
/** How many times a film is started over after the encoder is lost in the background. */
export const MAX_RESTARTS = 2;

export type FilmSink = { open: (options: VideoOptions) => void; finish: () => Promise<VideoFile>; cancel: () => void };

export type ExportInput = {
  video: VideoOptions;
  durationMs: number;
  /** Draws frame `index` (film time `timeMs`) and hands it to the open video. Throws when the encoder refuses it. */
  writeFrame: (index: number, timeMs: number) => void;
  sink: FilmSink;
  /** The app is in the foreground: the GPU can only be used there. */
  isActive: () => boolean;
  /** Resolves once the app is in the foreground again. */
  untilActive: () => Promise<void>;
  /** Gives the UI a turn between slices. */
  pause: () => Promise<void>;
  now: () => number;
  onProgress?: (done: number, total: number) => void;
  isCancelled: () => boolean;
};

/** How many frames a film of `durationMs` has: round(durationMs × fps / 1000), at least 1. Throws RangeError unless both are finite and positive. */
export function frameCount(durationMs: number, fps: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(fps) || fps <= 0) {
    throw new RangeError(`Invalid film length: ${durationMs} ms at ${fps} fps`);
  }
  return Math.max(1, Math.round((durationMs * fps) / 1000));
}

/** Writes the whole film. Resolves with the file, or with `null` when cancelled. */
export async function exportFilm(input: ExportInput): Promise<VideoFile | null> {
  const { video, sink } = input;
  const total = frameCount(input.durationMs, video.fps);

  const openOrFail = () => {
    try {
      sink.open(video);
    } catch (error) {
      sink.cancel();
      throw error;
    }
  };
  openOrFail();

  let restarts = 0;
  for (;;) {
    let waited = false;
    try {
      let done = 0;
      while (done < total) {
        if (!input.isActive()) {
          await input.untilActive();
          waited = true;
          // Cancel is observed while waiting in the background too.
          if (input.isCancelled()) {
            sink.cancel();
            return null;
          }
        }
        const sliceStart = input.now();
        do {
          input.writeFrame(done, (done * 1000) / video.fps);
          done += 1;
          // A slice also ends when the app leaves the foreground, so no frame is drawn in the background.
        } while (done < total && input.isActive() && input.now() - sliceStart < SLICE_MS);
        input.onProgress?.(done, total);
        if (done < total) {
          await input.pause();
          if (input.isCancelled()) {
            sink.cancel();
            return null;
          }
        }
      }
      return await sink.finish();
    } catch (error) {
      // A failure is restartable when the run waited in the background or the app has left the foreground since.
      if (!(waited || !input.isActive()) || restarts >= MAX_RESTARTS) {
        sink.cancel();
        throw error;
      }
      // iOS may have taken the encoder away while the app was in the background: start the film again.
      restarts += 1;
      sink.cancel();
      openOrFail();
    }
  }
}

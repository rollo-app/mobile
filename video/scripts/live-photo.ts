/** A Live Photo clip next to its still, as prepared by `npm run photos`. */
export type LiveClip = {
  /** Path relative to public/, e.g. "live/IMG_6198.mp4". */
  file: string;
  /** Seconds into the clip where the still photo was taken. */
  stillAt: number;
  /** Clip length in seconds. */
  duration: number;
};

export type StillTimeInput = {
  /** com.apple.quicktime.still-image-time sample (start, length in seconds). */
  markerPts?: number;
  markerDuration?: number;
  /** Start of the live-photo-still-image-transform sample, which Apple writes at the still. */
  transformPts?: number;
  duration: number;
};

/**
 * Where the still sits inside the clip. The still-image-time sample is only trusted when it is
 * short (exports may stretch it over the whole clip); then the transform sample; else the midpoint.
 */
export function pickStillAt(i: StillTimeInput): number {
  const inside = (t: number | undefined): t is number => t !== undefined && t > 0 && t < i.duration;
  if (i.markerDuration !== undefined && i.markerDuration < 0.25 && inside(i.markerPts)) return i.markerPts;
  if (inside(i.transformPts)) return i.transformPts;
  return i.duration / 2;
}

/**
 * Maps a viewfinder segment to the clip: `shutterFrame` is the segment-local frame where the still
 * must appear. `startFrom` is the first source frame; `hold` is how many segment frames the first
 * frame stays frozen when the clip has less lead-in than the segment needs.
 */
export function liveWindow(stillAt: number, fps: number, shutterFrame: number): { startFrom: number; hold: number } {
  const stillFrame = Math.round(stillAt * fps);
  const startFrom = stillFrame - shutterFrame;
  return startFrom >= 0 ? { startFrom, hold: 0 } : { startFrom: 0, hold: -startFrom };
}

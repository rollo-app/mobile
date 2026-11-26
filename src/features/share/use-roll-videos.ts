import { useEffect, useMemo, useRef, useState } from "react";
import { localDay } from "@/features/capture/quota";
import { useRevealedPhotos, type RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { videoAvailable } from "../../../modules/rollo-video";
import { rollVideoCounts, rollVideos, type RollVideoKind } from "./roll-videos";

/**
 * The videos of a roll from data the caller already has (the share screen). `ready`: the whole feed is in; `feedFailed`: it could not be loaded.
 * The array keeps its identity while the answer doesn't change.
 */
export function useRollVideos(args: { detail: TripDetail | null; photos: RevealedPhoto[]; ready: boolean; feedFailed: boolean }): RollVideoKind[] {
  const { detail, photos, ready, feedFailed } = args;
  const startsAt = detail?.trip.startsAt;
  const timezone = detail?.trip.timezone;
  // The stops of every candidate are not free to build: only when the photos or the first day change.
  const counts = useMemo(
    () => rollVideoCounts(photos, startsAt === undefined || timezone === undefined ? null : localDay(startsAt, timezone)),
    [photos, startsAt, timezone],
  );
  return useMemo(() => rollVideos({ detail, videoAvailable, ready, feedFailed, ...counts }), [detail, ready, feedFailed, counts]);
}

/**
 * The videos of a roll that loads its own data (the gallery's banner), plus the photos it needs. Empty while unknown. It
 * only asks for the rest of the feed once the roll could have a video at all (revealed, not private, a build with the video module).
 */
export function useTripRollVideos(tripId: string) {
  const { detail } = useTripDetail(tripId);
  const { photos, token, complete, loadAll, error } = useRevealedPhotos(tripId, "lazy");
  const mayHaveVideo = videoAvailable && detail?.trip.revealed === true && !detail.trip.featuringDisabled;
  // The whole feed decides which videos exist: load the rest of its pages once (a failed attempt is final: no video, no retry loop).
  const [attempted, setAttempted] = useState(false);
  const asked = useRef(false);
  useEffect(() => {
    if (!mayHaveVideo || complete || asked.current) return;
    asked.current = true;
    const done = () => setAttempted(true);
    loadAll().then(done, done);
  }, [mayHaveVideo, complete, loadAll]);
  const kinds = useRollVideos({ detail, photos, ready: complete, feedFailed: !!error || (attempted && !complete) });
  return { kinds, photos, token, detail };
}

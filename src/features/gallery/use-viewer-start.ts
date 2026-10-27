import { useEffect, useRef, useState } from "react";
import type { RevealedPhoto } from "@/features/media/revealed";

/**
 * Where the viewer starts: the index of photo `id` in the roll. If it is missing from what we have, the feed is asked
 * for once more; if it is still missing after that, `notFound`.
 */
export function useViewerStart(
  photos: RevealedPhoto[],
  id: string,
  tripId: string | undefined,
  loading: boolean,
  refetch: (options?: { cancelRefetch?: boolean }) => Promise<unknown>,
) {
  const startIndex = useRef<number | null>(null);
  // Locked only once the photo is found: a stale cached feed may not have it yet (a push for a new moment).
  if (startIndex.current === null) {
    const found = photos.findIndex((p) => p.id === id);
    if (found >= 0) startIndex.current = found;
  }
  // The photo is missing from what we have: ask the server once; if it is still missing, say so.
  const [missingChecked, setMissingChecked] = useState(false);
  const missing = startIndex.current === null;
  useEffect(() => {
    if (!missing || !tripId) return;
    let active = true;
    void refetch({ cancelRefetch: false }).finally(() => active && setMissingChecked(true));
    return () => {
      active = false;
    };
  }, [missing, tripId, refetch]);
  const notFound = missing && missingChecked && !loading;
  return { startIndex: startIndex.current, missing, notFound };
}

import { useCallback, useEffect, useId, useRef, useState } from "react";

/** Wait before each retry; after the last one we give up (the image stays blank until the screen remounts). */
export const IMAGE_RETRY_DELAYS_MS = [2000, 5000, 15000] as const;

/**
 * Makes an image that failed to load try again by itself, with backoff (2 s, 5 s, 15 s, then stop).
 *
 * expo-image never re-requests a source that didn't change, so a retry has to remount the view:
 * pass `retryKey` as the Image's `key` (the URL, and so the disk cache key, stays the same).
 * expo-image's iOS `retryFailed` option means SDWebImage doesn't blacklist the URL after an error.
 *
 *   const retry = useImageRetry(uri);
 *   <Image key={retry.retryKey} onError={retry.onError} onLoad={retry.onLoad} ... />
 *
 * Nothing is scheduled until an image errors, so it costs nothing in long lists. The timer dies with
 * the component. `resetKey` (the image shown, e.g. its id) forgets the failures when the cell is
 * recycled for another image.
 *
 * `retryKey` is unique per hook (`useId` + the attempt): two images side by side (a blurred backdrop
 * and the photo on top) would otherwise both start at key 0 and React would warn about duplicate keys.
 */
export function useImageRetry(resetKey?: string) {
  const id = useId();
  const [attempt, setAttempt] = useState(0);
  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const onError = useCallback(() => {
    if (timer.current) return; // a retry is already on its way
    const delay = IMAGE_RETRY_DELAYS_MS[failures.current];
    if (delay === undefined) return;
    failures.current += 1;
    timer.current = setTimeout(() => {
      timer.current = null;
      setAttempt((k) => k + 1);
    }, delay);
  }, []);

  const onLoad = useCallback(() => {
    failures.current = 0;
    cancel();
  }, [cancel]);

  useEffect(() => {
    failures.current = 0;
    cancel();
  }, [resetKey, cancel]);

  useEffect(() => cancel, [cancel]);

  return { retryKey: `${id}-${attempt}`, attempt, onError, onLoad };
}

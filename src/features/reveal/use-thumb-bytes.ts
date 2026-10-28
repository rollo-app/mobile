import { useEffect, useState } from "react";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";

export type ThumbBytes = { bytes: Record<string, ArrayBuffer>; settled: boolean };

const PENDING: ThumbBytes = { bytes: {}, settled: false };

/**
 * Downloads the thumbs into memory (with the session's Bearer, which Skia's `useImage` can't send).
 * `settled` flips once, together with `bytes`, when every thumb has loaded or failed, or after `capMs`,
 * whichever comes first: with weak signal the reveal starts with what it has instead of popping images
 * in mid-development. Thumbs that arrive after that are ignored. Decoding is left to `DarkroomIntro`
 * (Skia is native and this hook is mounted by the screen). `enabled` false does nothing yet.
 */
export function useThumbBytes(photos: RevealedPhoto[], token: string, enabled: boolean, capMs: number): ThumbBytes {
  const [state, setState] = useState<ThumbBytes>(PENDING);
  const ids = photos.map((p) => p.id).join(",");

  useEffect(() => {
    if (!enabled) return;
    const results: Record<string, ArrayBuffer> = {};
    let done = false;
    let remaining = photos.length;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      setState({ bytes: { ...results }, settled: true });
    };
    if (remaining === 0) {
      settle();
      return;
    }
    timer = setTimeout(settle, capMs);
    for (const photo of photos) {
      const finish = () => {
        remaining -= 1;
        if (remaining === 0) settle();
      };
      try {
        const { uri, headers } = mediaSource(photo.thumbPath, token);
        fetch(uri, { headers })
          .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
          .then((buffer) => {
            if (!done) results[photo.id] = buffer;
          })
          .catch(() => undefined)
          .then(finish);
      } catch {
        finish();
      }
    }
    return () => {
      done = true;
      if (timer) clearTimeout(timer);
    };
  }, [ids, token, enabled, capMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import { likeMedia, unlikeMedia } from "./actions";
import { cancelLikeRefetches, setLikedInCaches } from "./like-cache";

type Target = { id: string; likedByMe: boolean };

/**
 * Likes or unlikes a photo. Optimistic over every cached feed and featured list that has it; on failure
 * it puts the previous value back and exposes the server's message in `error` (with the photo it was for).
 * Liking gives a light haptic. A second toggle of the same photo while the first is pending is ignored.
 */
export function useToggleLike() {
  const client = useQueryClient();
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<{ mediaId: string; message: string } | null>(null);

  const toggle = useCallback(
    async (photo: Target) => {
      if (inFlight.current.has(photo.id)) return;
      inFlight.current.add(photo.id);
      setPending(new Set(inFlight.current));
      setError(null);

      const next = !photo.likedByMe;
      if (next) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await cancelLikeRefetches(client);
      setLikedInCaches(client, photo.id, next);
      try {
        await (next ? likeMedia : unlikeMedia)(photo.id);
      } catch (e) {
        setLikedInCaches(client, photo.id, !next);
        setError({ mediaId: photo.id, message: e instanceof Error ? e.message : "No se pudo cambiar el me gusta" });
      } finally {
        inFlight.current.delete(photo.id);
        setPending(new Set(inFlight.current));
      }
    },
    [client],
  );

  /** Double tap: likes, never takes a like away. */
  const like = useCallback(async (photo: Target) => {
    if (!photo.likedByMe) await toggle(photo);
  }, [toggle]);

  return { toggle, like, pending, error };
}

import { useEffect, useMemo, useState } from "react";
import type { Schemas } from "@/api/client";
import { API_URL } from "@/config";
import { getSession } from "@/features/auth/session";
import { useFeed } from "@/features/trips/use-feed";

/** A photo or video of a revealed roll, with the paths to download it. */
export type RevealedPhoto = {
  id: string;
  type: Schemas["MediaType"];
  takenAt: number;
  day: string;
  lat: number | null;
  lng: number | null;
  caption: string | null;
  durationS: number | null;
  width: number | null;
  height: number | null;
  thumbhash: string | null;
  author: Schemas["FeedItem"]["author"];
  /** The author's user id (to open their profile). */
  authorUserId: string;
  /** You featured it on your profile. */
  featuredByMe: boolean;
  /** Its author doesn't let others feature it (they still can). */
  featureBlocked: boolean;
  /** You can feature it on your profile now (false if its rollo is private or its author, their rollo setting or their account says no). */
  canFeature: boolean;
  /** How many people like it (one counter, also likes from profiles that feature it). */
  likeCount: number;
  /** You like it. */
  likedByMe: boolean;
  /** How many comments you see on it (0 for videos). */
  commentCount: number;
  /** Trip-local date of the daily moment this photo answers; null for ordinary photos. */
  momentDay: string | null;
  /** You (its author) archived it: nobody else sees it. Only ever true on your own photos. */
  archived: boolean;
  /** The selfie taken with a moment photo (null if none). Never likeable, commentable or featurable: those act on the main photo. */
  selfie: RevealedSelfie | null;
  thumbPath: string;
  originalPath: string;
};

export type RevealedSelfie = {
  id: string;
  thumbPath: string;
  originalPath: string;
  thumbhash: string | null;
  width: number | null;
  height: number | null;
};

/** Feed items that already have files (after the reveal; before it, only daily moments), oldest first. */
export function toRevealedPhotos(items: Schemas["FeedItem"][]): RevealedPhoto[] {
  return items
    .flatMap((item) =>
      item.files
        ? [
            {
              id: item.id,
              type: item.type,
              takenAt: item.takenAt,
              day: item.day,
              lat: item.lat,
              lng: item.lng,
              caption: item.caption,
              durationS: item.durationS,
              width: item.width ?? null,
              height: item.height ?? null,
              thumbhash: item.thumbhash,
              author: item.author,
              authorUserId: item.author.userId,
              featuredByMe: item.featuredByMe ?? false,
              featureBlocked: item.featureBlocked ?? false,
              canFeature: item.canFeature ?? true,
              likeCount: item.likeCount ?? 0,
              likedByMe: item.likedByMe ?? false,
              commentCount: item.commentCount ?? 0,
              momentDay: item.momentDay ?? null,
              archived: item.archived ?? false,
              selfie: item.selfie?.files
                ? {
                    id: item.selfie.id,
                    thumbPath: item.selfie.files.thumb,
                    originalPath: item.selfie.files.original,
                    thumbhash: item.selfie.thumbhash,
                    width: item.selfie.width,
                    height: item.selfie.height,
                  }
                : null,
              thumbPath: item.files.thumb,
              originalPath: item.files.original,
            },
          ]
        : [],
    )
    .sort((a, b) => a.takenAt - b.takenAt);
}

/** Image source for a media path: the API serves files with the same Bearer token as the rest (the session's). */
export function mediaSource(path: string, token: string, baseUrl: string = API_URL) {
  return { uri: `${baseUrl}${path}`, headers: { Authorization: `Bearer ${token}` } };
}

/**
 * The session token to load media with (`mediaSource`), read again whenever `key` changes; null until
 * it's read or while `key` is undefined. It stays in the keychain: read into memory, never into the
 * persisted query cache.
 */
export function useMediaToken(key: string | undefined) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setToken(null);
    if (key) getSession().then((t) => active && setToken(t));
    return () => {
      active = false;
    };
  }, [key]);
  return token;
}

/**
 * Revealed photos of a roll plus the token needed to load them (`mediaSource`).
 * Before the reveal `photos` holds only the daily moments (the one kind of photo the feed gives files for).
 */
export function useRevealedPhotos(tripId: string | undefined) {
  const { feed, error, loading, refetch, isRefetching } = useFeed(tripId);
  const token = useMediaToken(tripId);

  // Memoized on the feed so screens' derived lists (and memoized grid cells) don't rebuild on every render.
  const photos = useMemo(() => (feed ? toRevealedPhotos(feed.items) : []), [feed]);

  return {
    photos,
    token,
    error,
    loading,
    refetch,
    isRefetching,
  };
}

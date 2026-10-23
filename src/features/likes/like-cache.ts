import type { QueryClient } from "@tanstack/react-query";

type Likeable = { likedByMe?: boolean; likeCount?: number };

/** The item with your like set to `liked`, its count moved by one; unchanged if it already was. */
export function setLiked<T extends Likeable>(item: T, liked: boolean): T {
  const was = item.likedByMe ?? false;
  if (was === liked) return item;
  const count = item.likeCount ?? 0;
  return { ...item, likedByMe: liked, likeCount: Math.max(0, count + (liked ? 1 : -1)) };
}

/** The caches that carry likes: roll feeds (`["feed", tripId]`) and profiles' featured photos (`["featured", userId]`). */
const isLikeCache = (key: readonly unknown[]) => key[0] === "feed" || key[0] === "featured";

/**
 * Sets your like on a photo in every cached feed and featured list (the same photo can be in its roll
 * and on several profiles; it has one counter).
 */
export function setLikedInCaches(client: QueryClient, mediaId: string, liked: boolean) {
  for (const [key, data] of client.getQueriesData<unknown>({ predicate: (q) => isLikeCache(q.queryKey) })) {
    if (!data) continue;
    if (key[0] === "feed") {
      const feed = data as { items: ({ id: string } & Likeable)[] };
      client.setQueryData(key, { ...feed, items: feed.items.map((i) => (i.id === mediaId ? setLiked(i, liked) : i)) });
    } else {
      const photos = data as ({ mediaId: string } & Likeable)[];
      client.setQueryData(
        key,
        photos.map((p) => (p.mediaId === mediaId ? setLiked(p, liked) : p)),
      );
    }
  }
}

/** Stops in-flight refetches of the like caches that already have data, so they don't overwrite an optimistic like. */
export function cancelLikeRefetches(client: QueryClient) {
  return client.cancelQueries({ predicate: (q) => isLikeCache(q.queryKey) && q.state.data !== undefined });
}

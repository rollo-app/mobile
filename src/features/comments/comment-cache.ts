import type { QueryClient } from "@tanstack/react-query";

type Countable = { id: string; commentCount?: number };

/**
 * Moves one photo's `commentCount` by `delta` in every cached roll feed (`["feed", tripId]`), so the
 * count in the viewer follows your own comment without refetching the whole feed. Moments before the
 * reveal have no count yet: they start from zero. The next normal refetch brings the server's number.
 */
export function bumpCommentCount(client: QueryClient, mediaId: string, delta: 1 | -1) {
  for (const [key, data] of client.getQueriesData<{ items: Countable[] }>({ queryKey: ["feed"] })) {
    if (!data?.items.some((i) => i.id === mediaId)) continue;
    client.setQueryData(key, {
      ...data,
      items: data.items.map((i) => (i.id === mediaId ? { ...i, commentCount: Math.max(0, (i.commentCount ?? 0) + delta) } : i)),
    });
  }
}

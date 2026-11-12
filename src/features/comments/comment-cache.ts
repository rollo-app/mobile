import type { QueryClient } from "@tanstack/react-query";
import { mapFeedItemsEverywhere } from "@/features/trips/feed-cache";

/**
 * Moves one photo's `commentCount` by `delta` in every cached roll feed (whichever page holds it), so the
 * count in the viewer follows your own comment without refetching the whole feed. Moments before the
 * reveal have no count yet: they start from zero. The next normal refetch brings the server's number.
 */
export function bumpCommentCount(client: QueryClient, mediaId: string, delta: 1 | -1) {
  mapFeedItemsEverywhere(client, mediaId, (i) => ({ ...i, commentCount: Math.max(0, (i.commentCount ?? 0) + delta) }));
}

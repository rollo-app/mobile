import type { QueryClient } from "@tanstack/react-query";
import type { Feed, FeedPages } from "./actions";
import { feedKey, feedRootKey } from "./use-feed";

type FeedItem = Feed["items"][number];

/** `fn` over every page's items; the data (and each untouched page) keeps its identity when `fn` changes nothing. */
function mapPages(data: FeedPages, fn: (items: FeedItem[]) => FeedItem[]): FeedPages {
  let changed = false;
  const pages = data.pages.map((page) => {
    const items = fn(page.items);
    if (items === page.items) return page;
    changed = true;
    return { ...page, items };
  });
  return changed ? { ...data, pages } : data;
}

/** Applies `fn` to the items of every loaded page of a trip's feed (it returns the new list: map, filter...). No cache, no change. */
export function updateFeedItems(client: QueryClient, tripId: string, fn: (items: FeedItem[]) => FeedItem[]) {
  client.setQueryData<FeedPages>(feedKey(tripId), (data) => data && mapPages(data, fn));
}

/** Replaces one item (wherever its page is) with `fn(item)`; the other items and pages stay as they were. */
function mapOne(mediaId: string, fn: (item: FeedItem) => FeedItem) {
  return (items: FeedItem[]) => (items.some((i) => i.id === mediaId) ? items.map((i) => (i.id === mediaId ? fn(i) : i)) : items);
}

export function mapFeedItem(client: QueryClient, tripId: string, mediaId: string, fn: (item: FeedItem) => FeedItem) {
  updateFeedItems(client, tripId, mapOne(mediaId, fn));
}

/** Takes one item out of the cached feed (after a delete or a report). */
export function removeFeedItem(client: QueryClient, tripId: string, mediaId: string) {
  updateFeedItems(client, tripId, (items) => (items.some((i) => i.id === mediaId) ? items.filter((i) => i.id !== mediaId) : items));
}

/** The same edit in every trip's cached feed (a photo has one counter of likes or comments, whichever feed shows it). */
export function mapFeedItemsEverywhere(client: QueryClient, mediaId: string, fn: (item: FeedItem) => FeedItem) {
  for (const [key, data] of client.getQueriesData<FeedPages>({ queryKey: feedRootKey })) {
    if (data) client.setQueryData<FeedPages>(key, mapPages(data, mapOne(mediaId, fn)));
  }
}

/** What an optimistic edit saves to undo itself (undefined if the trip's feed isn't cached). */
export const snapshotFeed = (client: QueryClient, tripId: string) => client.getQueryData<FeedPages>(feedKey(tripId));

/** Puts a snapshot back: the rollback of an optimistic edit. */
export function restoreFeed(client: QueryClient, tripId: string, snapshot: FeedPages | undefined) {
  if (snapshot) client.setQueryData<FeedPages>(feedKey(tripId), snapshot);
}

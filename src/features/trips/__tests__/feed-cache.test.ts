import { QueryClient } from "@tanstack/react-query";
import { feedIds, feedItem, feedPagesOf } from "@/test/feed";
import type { FeedPages } from "../actions";
import { feedKey } from "../use-feed";
import { mapFeedItem, mapFeedItemsEverywhere, removeFeedItem, restoreFeed, snapshotFeed, updateFeedItems } from "../feed-cache";

const client = new QueryClient();
beforeEach(() => {
  client.clear();
  client.setQueryData(feedKey("t1"), feedPagesOf([feedItem("a"), feedItem("b")], [feedItem("c")], [feedItem("d")]));
  client.setQueryData(feedKey("t2"), feedPagesOf([feedItem("z")]));
});
const data = (tripId = "t1") => client.getQueryData<FeedPages>(feedKey(tripId));
const itemOf = (id: string) => data()!.pages.flatMap((p) => p.items).find((i) => i.id === id) as unknown as Record<string, unknown>;

describe("feed cache helpers", () => {
  it("keys the feed under its own root, apart from the old unpaged cache", () => {
    expect(feedKey("t1")[0]).not.toBe("feed");
  });

  it("updateFeedItems maps over every page and keeps the paging fields", () => {
    updateFeedItems(client, "t1", (items) => items.filter((i) => i.id !== "c"));
    expect(data()!.pages.map((p) => p.items.map((i) => i.id))).toEqual([["a", "b"], [], ["d"]]);
    expect(data()!.pages.map((p) => p.nextCursor)).toEqual(["c1", "c2", null]);
    expect(data()!.pageParams).toEqual([undefined, "c1", "c2"]);
  });

  it("mapFeedItem edits an item that lives in any page, leaving the rest untouched", () => {
    const before = data()!;
    mapFeedItem(client, "t1", "d", (i) => ({ ...i, caption: "hola" }));
    expect(itemOf("d").caption).toBe("hola");
    expect(itemOf("a").caption).toBeUndefined();
    expect(data()!.pages[0]).toBe(before.pages[0]);
  });

  it("removeFeedItem drops the item from its page", () => {
    removeFeedItem(client, "t1", "c");
    expect(feedIds(data())).toEqual(["a", "b", "d"]);
  });

  it("does nothing when the trip has no feed cached", () => {
    updateFeedItems(client, "nope", (items) => items);
    expect(client.getQueryData(feedKey("nope"))).toBeUndefined();
  });

  it("restores a snapshot taken before an optimistic edit", () => {
    const snapshot = snapshotFeed(client, "t1");
    mapFeedItem(client, "t1", "c", (i) => ({ ...i, featuredByMe: true }));
    expect(itemOf("c").featuredByMe).toBe(true);
    restoreFeed(client, "t1", snapshot);
    expect(itemOf("c").featuredByMe).toBeUndefined();
    expect(feedIds(data())).toEqual(["a", "b", "c", "d"]);
  });

  it("restoring an empty snapshot leaves the cache as it is", () => {
    restoreFeed(client, "t1", undefined);
    expect(feedIds(data())).toEqual(["a", "b", "c", "d"]);
  });

  it("mapFeedItemsEverywhere edits the item in every trip's feed", () => {
    client.setQueryData(feedKey("t2"), feedPagesOf([feedItem("a"), feedItem("z")]));
    mapFeedItemsEverywhere(client, "a", (i) => ({ ...i, caption: "x" }));
    expect((data("t2")!.pages[0]!.items[0] as unknown as { caption: string }).caption).toBe("x");
    expect(itemOf("a").caption).toBe("x");
    expect((data("t2")!.pages[0]!.items[1] as unknown as { caption?: string }).caption).toBeUndefined();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { feedItem, feedPagesOf } from "@/test/feed";
import { fetchFeedPage } from "../actions";
import { feedKey, useFeed } from "../use-feed";

jest.mock("../actions", () => ({ ...jest.requireActual("../actions"), fetchFeedPage: jest.fn() }));

const page = (ids: string[], nextCursor: string | null, extra: Record<string, unknown> = {}) => ({
  revealed: true,
  revealAt: 99,
  items: ids.map((id) => feedItem(id)),
  nextCursor,
  ...extra,
});

/** Three pages: a,b | c,d | e. */
function serve() {
  jest.mocked(fetchFeedPage).mockImplementation(async (_trip, { cursor }) => {
    if (!cursor) return page(["a", "b"], "c1") as never;
    if (cursor === "c1") return page(["c", "d"], "c2") as never;
    return page(["e"], null) as never;
  });
}

let client: QueryClient;
afterEach(() => client.clear());
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const ids = (feed: { items: { id: string }[] } | null) => feed?.items.map((i) => i.id);

beforeEach(() => {
  jest.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  serve();
});

describe("useFeed", () => {
  it("lazy: loads only the first page, with the page size as limit", async () => {
    const { result } = await renderHook(() => useFeed("t1", { mode: "lazy" }), { wrapper });
    await waitFor(() => expect(result.current.feed).not.toBeNull());
    expect(ids(result.current.feed)).toEqual(["a", "b"]);
    expect(result.current.feed).toMatchObject({ revealed: true, revealAt: 99 });
    expect(result.current.hasMore).toBe(true);
    expect(result.current.complete).toBe(false);
    expect(fetchFeedPage).toHaveBeenCalledTimes(1);
    expect(fetchFeedPage).toHaveBeenCalledWith("t1", { cursor: undefined, limit: 30 });
  });

  it("lazy: fetchMore appends the next page, in order, until there is no more", async () => {
    const { result } = await renderHook(() => useFeed("t1", { mode: "lazy" }), { wrapper });
    await waitFor(() => expect(result.current.feed).not.toBeNull());
    await act(async () => void (await result.current.fetchMore()));
    await waitFor(() => expect(ids(result.current.feed)).toEqual(["a", "b", "c", "d"]));
    expect(fetchFeedPage).toHaveBeenLastCalledWith("t1", { cursor: "c1", limit: 30 });
    await act(async () => void (await result.current.fetchMore()));
    await waitFor(() => expect(ids(result.current.feed)).toEqual(["a", "b", "c", "d", "e"]));
    expect(result.current.hasMore).toBe(false);
    expect(result.current.complete).toBe(true);
    expect(result.current.loadingMore).toBe(false);
  });

  it("lazy: fetchMore does nothing when everything is loaded", async () => {
    client.setQueryData(feedKey("t1"), feedPagesOf([feedItem("a")]));
    const { result } = await renderHook(() => useFeed("t1", { mode: "lazy" }), { wrapper });
    await act(async () => void (await result.current.fetchMore()));
    expect(fetchFeedPage).not.toHaveBeenCalled();
  });

  it("all: keeps loading pages by itself until the last one", async () => {
    const { result } = await renderHook(() => useFeed("t1", { mode: "all" }), { wrapper });
    await waitFor(() => expect(result.current.complete).toBe(true));
    expect(ids(result.current.feed)).toEqual(["a", "b", "c", "d", "e"]);
    expect(fetchFeedPage).toHaveBeenCalledTimes(3);
  });

  it("defaults to loading everything", async () => {
    const { result } = await renderHook(() => useFeed("t1"), { wrapper });
    await waitFor(() => expect(result.current.complete).toBe(true));
  });

  it("all: stops on a failed page instead of retrying forever, keeping what arrived", async () => {
    jest.mocked(fetchFeedPage).mockImplementation(async (_trip, { cursor }) => {
      if (!cursor) return page(["a"], "c1") as never;
      throw new Error("sin señal");
    });
    const { result } = await renderHook(() => useFeed("t1", { mode: "all" }), { wrapper });
    await waitFor(() => expect(fetchFeedPage).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(fetchFeedPage).toHaveBeenCalledTimes(2);
    expect(ids(result.current.feed)).toEqual(["a"]);
    expect(result.current.complete).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("both modes share one cache: a lazy screen's pages are not fetched again by an all screen", async () => {
    const lazy = await renderHook(() => useFeed("t1", { mode: "lazy" }), { wrapper });
    await waitFor(() => expect(lazy.result.current.feed).not.toBeNull());
    await act(async () => void (await lazy.result.current.fetchMore()));
    expect(fetchFeedPage).toHaveBeenCalledTimes(2);

    const all = await renderHook(() => useFeed("t1", { mode: "all" }), { wrapper });
    expect(ids(all.result.current.feed)).toEqual(["a", "b", "c", "d"]);
    await waitFor(() => expect(all.result.current.complete).toBe(true));
    expect(fetchFeedPage).toHaveBeenCalledTimes(3);
    expect(fetchFeedPage).toHaveBeenLastCalledWith("t1", { cursor: "c2", limit: 30 });
  });

  it("keeps the flattened feed's identity while nothing changes", async () => {
    const { result, rerender } = await renderHook(() => useFeed("t1", { mode: "lazy" }), { wrapper });
    await waitFor(() => expect(result.current.feed).not.toBeNull());
    const first = result.current.feed;
    await rerender({});
    expect(result.current.feed).toBe(first);
  });

  it("loadAll resolves with every item even from a lazy screen", async () => {
    const { result } = await renderHook(() => useFeed("t1", { mode: "lazy" }), { wrapper });
    await waitFor(() => expect(result.current.feed).not.toBeNull());
    let whole: Awaited<ReturnType<typeof result.current.loadAll>> | undefined;
    await act(async () => {
      whole = await result.current.loadAll();
    });
    expect(ids(whole!.feed)).toEqual(["a", "b", "c", "d", "e"]);
    expect(whole!.complete).toBe(true);
    expect(fetchFeedPage).toHaveBeenCalledTimes(3);
  });

  it("loadAll says it is incomplete when a page fails", async () => {
    jest.mocked(fetchFeedPage).mockImplementation(async (_trip, { cursor }) => {
      if (!cursor) return page(["a"], "c1") as never;
      throw new Error("sin señal");
    });
    const { result } = await renderHook(() => useFeed("t1", { mode: "lazy" }), { wrapper });
    await waitFor(() => expect(result.current.feed).not.toBeNull());
    let whole: Awaited<ReturnType<typeof result.current.loadAll>> | undefined;
    await act(async () => {
      whole = await result.current.loadAll();
    });
    expect(whole!.complete).toBe(false);
  });

  it("shows the error only when there is no data at all", async () => {
    jest.mocked(fetchFeedPage).mockRejectedValue(new Error("sin señal"));
    const { result } = await renderHook(() => useFeed("t1", { mode: "lazy" }), { wrapper });
    await waitFor(() => expect(result.current.error).toBe("sin señal"));
    expect(result.current.feed).toBeNull();
  });

  it("does nothing without a trip", async () => {
    const { result } = await renderHook(() => useFeed(undefined), { wrapper });
    expect(fetchFeedPage).not.toHaveBeenCalled();
    expect(result.current.feed).toBeNull();
  });
});

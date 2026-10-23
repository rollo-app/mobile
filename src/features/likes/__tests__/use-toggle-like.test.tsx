import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import type { Schemas } from "@/api/client";
import { createQueryClient } from "@/api/query-client";
import { featuredKey } from "@/features/featured/use-featured";
import { feedKey } from "@/features/trips/use-feed";
import { setSessionToken } from "@/storage/session";
import { featuredPhoto } from "@/test/featured";
import { useToggleLike } from "../use-toggle-like";

jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Light: "light" } }));

type Feed = Schemas["Feed"];

const item = (id: string, likedByMe: boolean, likeCount: number): Feed["items"][number] => ({
  id,
  type: "photo",
  takenAt: 1,
  day: "2027-01-12",
  lat: null,
  lng: null,
  caption: null,
  durationS: null,
  thumbhash: null,
  author: { id: "m2", userId: "u2", name: "Cami", username: null, avatarUrl: null },
  files: { thumb: `/t/${id}/thumb`, original: `/t/${id}/original` },
  likedByMe,
  likeCount,
});

const client = createQueryClient();
afterEach(() => client.clear());

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const inFeed = (id: string) => {
  const i = client.getQueryData<Feed>(feedKey("t1"))!.items.find((x) => x.id === id)!;
  return { likedByMe: i.likedByMe, likeCount: i.likeCount };
};
const inFeatured = (id: string) => {
  const p = client.getQueryData<Schemas["FeaturedPhoto"][]>(featuredKey("u9"))!.find((x) => x.mediaId === id)!;
  return { likedByMe: p.likedByMe, likeCount: p.likeCount };
};

/** fetch that waits until `release(status, body)` is called. */
function deferredFetch() {
  const calls: Request[] = [];
  let release!: (status: number, body?: unknown) => void;
  globalThis.fetch = jest.fn(
    (req: Request) =>
      new Promise<Response>((resolve) => {
        calls.push(req);
        release = (status, body) => resolve(new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
      }),
  ) as unknown as typeof fetch;
  return { calls, release: (status: number, body?: unknown) => release(status, body) };
}

beforeEach(() => {
  setSessionToken("tok");
  jest.mocked(Haptics.impactAsync).mockClear();
});

describe("useToggleLike", () => {
  it("likes before the server answers, in the roll's feed and on every profile that features it", async () => {
    client.setQueryData(feedKey("t1"), { items: [item("a", false, 2), item("b", false, 0)] } as unknown as Feed);
    client.setQueryData(featuredKey("u9"), [featuredPhoto("a", { likeCount: 2 }), featuredPhoto("c")]);
    const net = deferredFetch();
    const { result } = await renderHook(() => useToggleLike(), { wrapper });

    let done!: Promise<void>;
    await act(async () => {
      done = result.current.toggle({ id: "a", likedByMe: false });
    });

    await waitFor(() => expect(inFeed("a")).toEqual({ likedByMe: true, likeCount: 3 }));
    expect(inFeatured("a")).toEqual({ likedByMe: true, likeCount: 3 });
    expect(inFeed("b")).toEqual({ likedByMe: false, likeCount: 0 });
    expect(inFeatured("c")).toEqual({ likedByMe: false, likeCount: 0 });
    expect(net.calls[0]!.method).toBe("PUT");
    expect(new URL(net.calls[0]!.url).pathname).toBe("/media/a/like");
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");

    await act(async () => {
      net.release(204);
      await done;
    });
    expect(inFeed("a")).toEqual({ likedByMe: true, likeCount: 3 });
    expect(result.current.pending.size).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("unlikes with a DELETE and no haptic", async () => {
    client.setQueryData(feedKey("t1"), { items: [item("a", true, 3)] } as unknown as Feed);
    const net = deferredFetch();
    const { result } = await renderHook(() => useToggleLike(), { wrapper });

    let done!: Promise<void>;
    await act(async () => {
      done = result.current.toggle({ id: "a", likedByMe: true });
    });
    await waitFor(() => expect(inFeed("a")).toEqual({ likedByMe: false, likeCount: 2 }));
    expect(net.calls[0]!.method).toBe("DELETE");
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    await act(async () => {
      net.release(204);
      await done;
    });
  });

  it("reverts and says why for that photo when it fails", async () => {
    client.setQueryData(feedKey("t1"), { items: [item("a", false, 2)] } as unknown as Feed);
    client.setQueryData(featuredKey("u9"), [featuredPhoto("a", { likeCount: 2 })]);
    const net = deferredFetch();
    const { result } = await renderHook(() => useToggleLike(), { wrapper });

    let done!: Promise<void>;
    await act(async () => {
      done = result.current.toggle({ id: "a", likedByMe: false });
    });
    await waitFor(() => expect(inFeed("a").likedByMe).toBe(true));

    await act(async () => {
      net.release(404, { error: "No encontramos esa foto" });
      await done;
    });
    expect(inFeed("a")).toEqual({ likedByMe: false, likeCount: 2 });
    expect(inFeatured("a")).toEqual({ likedByMe: false, likeCount: 2 });
    expect(result.current.error).toEqual({ mediaId: "a", message: "No encontramos esa foto" });
    expect(result.current.pending.size).toBe(0);
  });

  it("ignores a second toggle of the same photo while the first is pending", async () => {
    client.setQueryData(feedKey("t1"), { items: [item("a", false, 0)] } as unknown as Feed);
    const net = deferredFetch();
    const { result } = await renderHook(() => useToggleLike(), { wrapper });

    let first!: Promise<void>;
    await act(async () => {
      first = result.current.toggle({ id: "a", likedByMe: false });
    });
    await waitFor(() => expect(inFeed("a").likedByMe).toBe(true));
    await act(async () => {
      await result.current.toggle({ id: "a", likedByMe: true });
    });
    expect(net.calls).toHaveLength(1);
    await act(async () => {
      net.release(204);
      await first;
    });
    expect(inFeed("a")).toEqual({ likedByMe: true, likeCount: 1 });
  });

  it("like() never takes a like away", async () => {
    client.setQueryData(feedKey("t1"), { items: [item("a", true, 1)] } as unknown as Feed);
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { result } = await renderHook(() => useToggleLike(), { wrapper });

    await act(async () => {
      await result.current.like({ id: "a", likedByMe: true });
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(inFeed("a")).toEqual({ likedByMe: true, likeCount: 1 });
  });

  it("like() likes a photo you didn't like", async () => {
    client.setQueryData(feedKey("t1"), { items: [item("a", false, 0)] } as unknown as Feed);
    globalThis.fetch = jest.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    const { result } = await renderHook(() => useToggleLike(), { wrapper });

    await act(async () => {
      await result.current.like({ id: "a", likedByMe: false });
    });
    expect(inFeed("a")).toEqual({ likedByMe: true, likeCount: 1 });
  });
});

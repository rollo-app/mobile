import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import { feedKey } from "@/features/trips/use-feed";
import { setSessionToken } from "@/storage/session";
import { useAddComment } from "../use-add-comment";
import { useDeleteComment } from "../use-delete-comment";
import { commentsKey } from "../use-comments";

const client = createQueryClient();
afterEach(() => client.clear());
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

const item = (id: string, commentCount?: number) => ({ id, type: "photo", commentCount });
const countOf = (tripId: string, id: string) =>
  (client.getQueryData<{ items: { id: string; commentCount?: number }[] }>(feedKey(tripId)))!.items.find((i) => i.id === id)!.commentCount;

let calls: string[];
beforeEach(async () => {
  await setSessionToken("tok");
  calls = [];
  globalThis.fetch = jest.fn(async (req: Request) => {
    calls.push(`${req.method} ${new URL(req.url).pathname}`);
    if (req.method === "GET") return new Response(JSON.stringify({ comments: [] }), { status: 200, headers: { "content-type": "application/json" } });
    if (req.method === "DELETE") return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ id: "c1", text: "hola", createdAt: 1, author: { userId: "u1", name: "J", username: null, avatarUrl: null }, canDelete: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  client.setQueryData(feedKey("t1"), { revealed: true, items: [item("a", 2), item("b", 5)] });
  client.setQueryData(feedKey("t2"), { revealed: true, items: [item("z", 1)] });
});

describe("comment counts in the feed", () => {
  it("adding a comment adds one to that photo's count without refetching any feed", async () => {
    const { result } = await renderHook(() => useAddComment("a"), { wrapper });
    await act(async () => result.current.mutate("hola"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(countOf("t1", "a")).toBe(3);
    expect(countOf("t1", "b")).toBe(5);
    expect(countOf("t2", "z")).toBe(1);
    expect(calls.filter((c) => c.includes("/feed"))).toEqual([]);
    expect(client.getQueryState(feedKey("t1"))!.isInvalidated).toBe(false);
  });

  it("counts from zero when the item has no count yet (moments before the reveal)", async () => {
    client.setQueryData(feedKey("t1"), { revealed: false, items: [item("a")] });
    const { result } = await renderHook(() => useAddComment("a"), { wrapper });
    await act(async () => result.current.mutate("hola"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(countOf("t1", "a")).toBe(1);
  });

  it("deleting a comment takes one from the count, never below zero, without refetching any feed", async () => {
    const { result } = await renderHook(() => useDeleteComment("a"), { wrapper });
    await act(async () => result.current.mutate("c1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(countOf("t1", "a")).toBe(1);

    await act(async () => result.current.mutate("c2"));
    await act(async () => result.current.mutate("c3"));
    await waitFor(() => expect(countOf("t1", "a")).toBe(0));
    expect(calls.filter((c) => c.includes("/feed"))).toEqual([]);
  });

  it("still refreshes the photo's own comment list", async () => {
    client.setQueryData(commentsKey("a"), []);
    const { result } = await renderHook(() => useAddComment("a"), { wrapper });
    await act(async () => result.current.mutate("hola"));
    await waitFor(() => expect(client.getQueryState(commentsKey("a"))!.isInvalidated).toBe(true));
  });

  it("refreshes Tu actividad > Comentarios when you add or delete a comment", async () => {
    client.setQueryData(["my-comments"], { pages: [], pageParams: [] });
    const add = await renderHook(() => useAddComment("a"), { wrapper });
    await act(async () => add.result.current.mutate("hola"));
    await waitFor(() => expect(client.getQueryState(["my-comments"])!.isInvalidated).toBe(true));

    client.setQueryData(["my-comments"], { pages: [], pageParams: [] });
    const del = await renderHook(() => useDeleteComment("a"), { wrapper });
    await act(async () => del.result.current.mutate("c1"));
    await waitFor(() => expect(client.getQueryState(["my-comments"])!.isInvalidated).toBe(true));
  });
});

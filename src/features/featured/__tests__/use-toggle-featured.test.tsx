import * as Burnt from "burnt";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import type { Schemas } from "@/api/client";
import { createQueryClient } from "@/api/query-client";
import { meKey } from "@/features/auth/actions";
import { feedKey } from "@/features/trips/use-feed";
import { setSessionToken } from "@/storage/session";
import { USER } from "@/test/account";
import { featuredKey } from "../use-featured";
import { useToggleFeatured } from "../use-toggle-featured";

type Feed = Schemas["Feed"];

const item = (id: string, featuredByMe: boolean): Feed["items"][number] => ({
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
  featuredByMe,
  featureBlocked: false,
});

const client = createQueryClient();
afterEach(() => client.clear());

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function seed(items: Feed["items"]) {
  client.setQueryData(meKey, USER);
  client.setQueryData(feedKey("t1"), { items } as unknown as Feed);
}
const featuredInCache = (id: string) =>
  client.getQueryData<Feed>(feedKey("t1"))!.items.find((i) => i.id === id)!.featuredByMe;

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
  (Burnt.alert as jest.Mock).mockClear();
});

describe("useToggleFeatured", () => {
  it("marks the photo as featured in the feed before the server answers, then invalidates my featured list", async () => {
    seed([item("a", false), item("b", false)]);
    client.setQueryData(featuredKey(USER.id), []);
    const net = deferredFetch();
    const { result } = await renderHook(() => useToggleFeatured(), { wrapper });

    let done!: Promise<void>;
    await act(async () => {
      done = result.current.toggle({ id: "a", featuredByMe: false }, "t1");
    });

    await waitFor(() => expect(featuredInCache("a")).toBe(true));
    expect(featuredInCache("b")).toBe(false);
    await waitFor(() => expect(result.current.pending.has("a")).toBe(true));
    expect(net.calls[0]!.method).toBe("PUT");
    expect(new URL(net.calls[0]!.url).pathname).toBe("/me/featured/a");

    await act(async () => {
      net.release(204);
      await done;
    });
    expect(featuredInCache("a")).toBe(true);
    expect(result.current.pending.size).toBe(0);
    expect(result.current.error).toBeNull();
    expect(client.getQueryState(featuredKey(USER.id))?.isInvalidated).toBe(true);
  });

  it("unfeatures with a DELETE", async () => {
    seed([item("a", true)]);
    const net = deferredFetch();
    const { result } = await renderHook(() => useToggleFeatured(), { wrapper });

    let done!: Promise<void>;
    await act(async () => {
      done = result.current.toggle({ id: "a", featuredByMe: true }, "t1");
    });
    await waitFor(() => expect(featuredInCache("a")).toBe(false));
    expect(net.calls[0]!.method).toBe("DELETE");

    await act(async () => {
      net.release(204);
      await done;
    });
    expect(featuredInCache("a")).toBe(false);
  });

  it("reverts and exposes the server's message when it fails", async () => {
    seed([item("a", false)]);
    const net = deferredFetch();
    const { result } = await renderHook(() => useToggleFeatured(), { wrapper });

    let done!: Promise<void>;
    await act(async () => {
      done = result.current.toggle({ id: "a", featuredByMe: false }, "t1");
    });
    await waitFor(() => expect(featuredInCache("a")).toBe(true));

    await act(async () => {
      net.release(409, { error: "Podés destacar hasta 60 fotos" });
      await done;
    });
    expect(featuredInCache("a")).toBe(false);
    expect(result.current.error).toBe("Podés destacar hasta 60 fotos");
    expect(result.current.pending.size).toBe(0);
  });

  it("ignores a second toggle of the same photo while the first is pending", async () => {
    seed([item("a", false)]);
    const net = deferredFetch();
    const { result } = await renderHook(() => useToggleFeatured(), { wrapper });

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = result.current.toggle({ id: "a", featuredByMe: false }, "t1");
    });
    await waitFor(() => expect(featuredInCache("a")).toBe(true));
    await act(async () => {
      // The UI re-renders with the optimistic value, so a second tap asks to unfeature.
      second = result.current.toggle({ id: "a", featuredByMe: true }, "t1");
    });
    await act(async () => {
      await second;
    });
    expect(net.calls).toHaveLength(1);
    expect(featuredInCache("a")).toBe(true);

    await act(async () => {
      net.release(204);
      await first;
    });
    expect(net.calls).toHaveLength(1);
    expect(featuredInCache("a")).toBe(true);
  });

  it("clears a previous error on the next toggle", async () => {
    seed([item("a", false)]);
    globalThis.fetch = jest.fn(async () => new Response(JSON.stringify({ error: "Este perfil es privado" }), { status: 403, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    const { result } = await renderHook(() => useToggleFeatured(), { wrapper });

    await act(async () => {
      await result.current.toggle({ id: "a", featuredByMe: false }, "t1");
    });
    expect(result.current.error).toBe("Este perfil es privado");

    globalThis.fetch = jest.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    await act(async () => {
      await result.current.toggle({ id: "a", featuredByMe: false }, "t1");
    });
    expect(result.current.error).toBeNull();
    expect(featuredInCache("a")).toBe(true);
  });

  describe("confirmation HUD", () => {
    const ok = () => (globalThis.fetch = jest.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch);

    it("shows the native HUD once after the server confirms adding to the profile", async () => {
      seed([item("a", false)]);
      const net = deferredFetch();
      const { result } = await renderHook(() => useToggleFeatured(), { wrapper });
      let done!: Promise<void>;
      await act(async () => {
        done = result.current.toggle({ id: "a", featuredByMe: false }, "t1");
      });
      await waitFor(() => expect(featuredInCache("a")).toBe(true));
      expect(Burnt.alert).not.toHaveBeenCalled();
      await act(async () => {
        net.release(204);
        await done;
      });
      expect(Burnt.alert).toHaveBeenCalledTimes(1);
      expect(Burnt.alert).toHaveBeenCalledWith({ title: "Agregada a tu perfil", preset: "done", duration: 2 });
    });

    it("does not show the HUD when the server rejects", async () => {
      seed([item("a", false)]);
      globalThis.fetch = jest.fn(async () => new Response(JSON.stringify({ error: "Podés destacar hasta 60 fotos" }), { status: 409, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
      const { result } = await renderHook(() => useToggleFeatured(), { wrapper });
      await act(async () => {
        await result.current.toggle({ id: "a", featuredByMe: false }, "t1");
      });
      expect(Burnt.alert).not.toHaveBeenCalled();
    });

    it("does not show the HUD when removing from the profile", async () => {
      seed([item("a", true)]);
      ok();
      const { result } = await renderHook(() => useToggleFeatured(), { wrapper });
      await act(async () => {
        await result.current.toggle({ id: "a", featuredByMe: true }, "t1");
      });
      expect(Burnt.alert).not.toHaveBeenCalled();
    });
  });
});

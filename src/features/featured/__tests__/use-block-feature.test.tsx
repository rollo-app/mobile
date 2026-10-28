import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import { feedKey } from "@/features/trips/use-feed";
import { setSessionToken } from "@/storage/session";
import { useBlockFeature } from "../use-block-feature";

const client = createQueryClient();
afterEach(() => client.clear());
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => setSessionToken("tok"));

describe("useBlockFeature", () => {
  it("blocks with PUT and invalidates the roll's feed", async () => {
    const fetchMock = jest.fn(async () => json(204));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    client.setQueryData(feedKey("t1"), { items: [] });
    const { result } = await renderHook(() => useBlockFeature(), { wrapper });
    await act(async () => result.current.setBlocked("m1", "t1", true));
    const req = (fetchMock.mock.calls[0] as unknown as [Request])[0];
    expect(req.method).toBe("PUT");
    expect(req.url).toContain("/media/m1/feature-block");
    expect(client.getQueryState(feedKey("t1"))?.isInvalidated).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("also refreshes who featured your photos", async () => {
    globalThis.fetch = jest.fn(async () => json(204)) as unknown as typeof fetch;
    client.setQueryData(["featured-by"], { pages: [], pageParams: [] });
    const { result } = await renderHook(() => useBlockFeature(), { wrapper });
    await act(async () => result.current.setBlocked("m1", "t1", true));
    expect(client.getQueryState(["featured-by"])?.isInvalidated).toBe(true);
  });

  it("unblocks with DELETE", async () => {
    const fetchMock = jest.fn(async () => json(204));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { result } = await renderHook(() => useBlockFeature(), { wrapper });
    await act(async () => result.current.setBlocked("m1", "t1", false));
    expect((fetchMock.mock.calls[0] as unknown as [Request])[0].method).toBe("DELETE");
  });

  it("exposes the server's message on failure, and reset clears it", async () => {
    globalThis.fetch = jest.fn(async () => json(409, { error: "No se puede" })) as unknown as typeof fetch;
    const { result } = await renderHook(() => useBlockFeature(), { wrapper });
    await act(async () => result.current.setBlocked("m1", "t1", true));
    await waitFor(() => expect(result.current.error).toBe("No se puede"));
    await act(async () => result.current.reset());
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it("reports blocking while the request is pending", async () => {
    let release!: () => void;
    const fetchMock = jest.fn(() => new Promise<Response>((resolve) => (release = () => resolve(json(204)))));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { result } = await renderHook(() => useBlockFeature(), { wrapper });
    await act(async () => {
      void result.current.setBlocked("m1", "t1", true);
    });
    await waitFor(() => expect(result.current.blocking).toBe(true));
    await act(async () => release());
    await waitFor(() => expect(result.current.blocking).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

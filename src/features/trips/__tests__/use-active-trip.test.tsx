import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import { setActiveTripId } from "@/storage/active-trip";
import { setSessionToken } from "@/storage/session";
import { useActiveTrip } from "../use-active-trip";

jest.mock("expo-router", () => ({ useFocusEffect: (cb: () => void) => require("react").useEffect(cb, []) }));

const trip = (id: string) => ({ id, name: `Rollo ${id}`, joinCode: "ABC234", startsAt: 0, endsAt: 1, revealAt: 1, revealed: false, role: "member", totalUploaded: 0 });

const client = createQueryClient();
afterEach(() => client.clear()); // otherwise its 7-day gc timers keep Jest from exiting

function wrapper() {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockTrips(ids: string[]) {
  globalThis.fetch = jest.fn(async () => new Response(JSON.stringify({ trips: ids.map(trip) }), { status: 200 })) as unknown as typeof fetch;
}

beforeEach(() => setSessionToken("tok"));

describe("useActiveTrip", () => {
  it("is the saved trip when it's in the server's list", async () => {
    mockTrips(["a", "b"]);
    await setActiveTripId("b");
    const { result } = await renderHook(() => useActiveTrip(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.trip?.id).toBe("b");
    expect(result.current.trips).toHaveLength(2);
  });

  it("is the most recent of the list when none is saved", async () => {
    mockTrips(["a", "b"]);
    const { result } = await renderHook(() => useActiveTrip(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.trip?.id).toBe("a");
  });

  it("has no active trip when the list is empty", async () => {
    mockTrips([]);
    const { result } = await renderHook(() => useActiveTrip(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.trip).toBeNull();
  });

  it("stays loaded while it retries after a failure, so screens don't swap and remount in a loop", async () => {
    client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } });
    globalThis.fetch = jest.fn(async () => {
      throw new Error("Sin conexión");
    }) as unknown as typeof fetch;
    const { result } = await renderHook(() => useActiveTrip(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    let release!: () => void;
    globalThis.fetch = jest.fn(() => new Promise<Response>((resolve) => (release = () => resolve(new Response(JSON.stringify({ trips: [] }), { status: 200 }))))) as unknown as typeof fetch;
    void result.current.refetch();

    await waitFor(() => expect((globalThis.fetch as jest.Mock).mock.calls.length).toBe(1));
    expect(result.current.loaded).toBe(true);
    release();
  });
});

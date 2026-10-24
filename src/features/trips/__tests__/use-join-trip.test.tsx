import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import * as actions from "../actions";
import { myTripsKey } from "../use-active-trip";
import { useCreateTrip } from "../use-create-trip";
import { useJoinTrip } from "../use-join-trip";

jest.mock("../actions");

function setup() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  queryClient.setQueryData(myTripsKey, { trips: [] });
  return { queryClient, wrapper };
}

describe("useJoinTrip", () => {
  it("invalidates my trips after joining", async () => {
    jest.mocked(actions).joinTrip.mockResolvedValue({} as never);
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useJoinTrip(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ code: "ABC123" });
    });
    expect(queryClient.getQueryState(myTripsKey)?.isInvalidated).toBe(true);
  });

  it("leaves the cache alone when joining fails", async () => {
    jest.mocked(actions).joinTrip.mockRejectedValue(new Error("nope"));
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useJoinTrip(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ code: "ABC123" }).catch(() => {});
    });
    expect(queryClient.getQueryState(myTripsKey)?.isInvalidated).toBe(false);
  });
});

describe("useCreateTrip", () => {
  it("invalidates my trips after creating", async () => {
    jest.mocked(actions).createTrip.mockResolvedValue({} as never);
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useCreateTrip(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({} as never);
    });
    expect(queryClient.getQueryState(myTripsKey)?.isInvalidated).toBe(true);
  });
});

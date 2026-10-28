import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import { tripKey } from "@/features/trips/use-trip-detail";
import * as actions from "../actions";
import { friendKey } from "../use-friend";
import { useAddFriendsToTrip } from "../use-add-friends-to-trip";

jest.mock("../actions");

function setup() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  queryClient.setQueryData(tripKey("t1"), {});
  queryClient.setQueryData(friendKey("f1"), {});
  queryClient.setQueryData(friendKey("f2"), {});
  return { queryClient, wrapper };
}

describe("useAddFriendsToTrip", () => {
  beforeEach(() => jest.resetAllMocks());

  it("invalidates the roll and the friends who got in, and hands the results to onSuccess", async () => {
    const results = [
      { userId: "f1", status: "added" },
      { userId: "f2", status: "unavailable" },
    ];
    jest.mocked(actions).addFriendsToTrip.mockResolvedValue(results as never);
    const { queryClient, wrapper } = setup();
    const onSuccess = jest.fn();
    const { result } = await renderHook(() => useAddFriendsToTrip(), { wrapper });
    await act(async () => {
      result.current.add({ tripId: "t1", friendIds: ["f1", "f2"] }, onSuccess);
    });
    expect(actions.addFriendsToTrip).toHaveBeenCalledWith("t1", ["f1", "f2"]);
    expect(queryClient.getQueryState(tripKey("t1"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(friendKey("f1"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(friendKey("f2"))?.isInvalidated).toBe(false);
    expect(onSuccess).toHaveBeenCalledWith(results);
  });

  it("exposes the error and leaves the cache alone when the request fails", async () => {
    jest.mocked(actions).addFriendsToTrip.mockRejectedValue(new Error("nope"));
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useAddFriendsToTrip(), { wrapper });
    await act(async () => {
      result.current.add({ tripId: "t1", friendIds: ["f1"] });
    });
    await waitFor(() => expect(result.current.error).toEqual(new Error("nope")));
    expect(queryClient.getQueryState(tripKey("t1"))?.isInvalidated).toBe(false);
  });

  it("ignores a second call while the first is pending", async () => {
    let finish: (v: never[]) => void = () => {};
    jest.mocked(actions).addFriendsToTrip.mockReturnValue(new Promise((r) => (finish = r)));
    const { wrapper } = setup();
    const { result } = await renderHook(() => useAddFriendsToTrip(), { wrapper });
    await act(async () => {
      result.current.add({ tripId: "t1", friendIds: ["f1"] });
      result.current.add({ tripId: "t1", friendIds: ["f2"] });
    });
    expect(actions.addFriendsToTrip).toHaveBeenCalledTimes(1);
    await act(async () => finish([]));
  });
});

import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Alert } from "react-native";
import { createQueryClient } from "@/api/query-client";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { userFriendsKey } from "@/features/profile/use-user-friends";
import * as actions from "../actions";
import { useBlock } from "../use-block";
import { useReport } from "../use-report";

jest.mock("../actions");

function setup() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, wrapper };
}

describe("useReport", () => {
  it("keeps reportMedia and reportUser stable across renders", async () => {
    const { wrapper } = setup();
    const { result, rerender } = await renderHook(() => useReport(), { wrapper });
    const first = result.current;
    await rerender({});
    expect(result.current.reportMedia).toBe(first.reportMedia);
    expect(result.current.reportUser).toBe(first.reportUser);
  });
});

describe("useBlock", () => {
  it("refreshes my rollos and the profile friend lists after unblocking", async () => {
    jest.mocked(actions).unblockUser.mockResolvedValue(undefined);
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(myTripsKey, { trips: [] });
    queryClient.setQueryData(userFriendsKey("u2"), { scope: "all", friends: [] });
    const { result } = await renderHook(() => useBlock("u2", "Cami"), { wrapper });
    await act(async () => {
      await result.current.unblock();
    });
    expect(queryClient.getQueryState(myTripsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(userFriendsKey("u2"))?.isInvalidated).toBe(true);
  });

  it("refreshes them after confirming a block", async () => {
    jest.mocked(actions).blockUser.mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(myTripsKey, { trips: [] });
    queryClient.setQueryData(userFriendsKey("u2"), { scope: "all", friends: [] });
    const { result } = await renderHook(() => useBlock("u2", "Cami"), { wrapper });
    act(() => result.current.confirmBlock());
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => {
      buttons.find((b) => b.text === "Bloquear")!.onPress!();
    });
    await waitFor(() => expect(queryClient.getQueryState(myTripsKey)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(userFriendsKey("u2"))?.isInvalidated).toBe(true);
    alert.mockRestore();
  });
});

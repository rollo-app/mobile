import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import { userKey } from "@/features/profile/use-user";
import * as actions from "../actions";
import { useRemoveFriend } from "../use-remove-friend";
import { friendsKey } from "../use-friends";

jest.mock("../actions");

function setup() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  queryClient.setQueryData(friendsKey, [{ id: "f1" }, { id: "f2" }]);
  queryClient.setQueryData(userKey("f1"), {});
  return { queryClient, wrapper };
}

describe("useRemoveFriend", () => {
  beforeEach(() => jest.resetAllMocks());

  it("drops the friend from the list and marks their profile stale without refetching it", async () => {
    jest.mocked(actions).removeFriend.mockResolvedValue(undefined);
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useRemoveFriend(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("f1");
    });
    expect(actions.removeFriend).toHaveBeenCalledWith("f1");
    expect(queryClient.getQueryData<{ id: string }[]>(friendsKey)?.map((f) => f.id)).toEqual(["f2"]);
    expect(queryClient.getQueryState(userKey("f1"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(userKey("f1"))?.fetchStatus).toBe("idle");
  });

  it("keeps the list when removing fails", async () => {
    jest.mocked(actions).removeFriend.mockRejectedValue(new Error("nope"));
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useRemoveFriend(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("f1").catch(() => {});
    });
    expect(queryClient.getQueryData<unknown[]>(friendsKey)).toHaveLength(2);
  });
});

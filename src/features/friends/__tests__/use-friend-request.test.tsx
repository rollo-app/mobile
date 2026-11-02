import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import * as actions from "../actions";
import { useFriendRequest } from "../use-friend-request";
import { friendsKey } from "../use-friends";
import { userSearchKey } from "../use-user-search";

jest.mock("../actions");

const cami = { id: "u1", name: "Cami", username: "cami", avatarUrl: null, mutualCount: 1, friendRequest: "none" as const };
const other = { id: "u2", name: "Camilo", username: "camilo", avatarUrl: null, mutualCount: 0, friendRequest: "none" as const };

function setup() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  queryClient.setQueryData(userSearchKey("cami"), [cami, other]);
  queryClient.setQueryData(friendsKey, [{ id: "f1", name: "F", username: "f", avatarUrl: null, bio: null }]);
  return { queryClient, wrapper };
}

const requestOf = (queryClient: ReturnType<typeof setup>["queryClient"]) => queryClient.getQueryData<(typeof cami)[]>(userSearchKey("cami"))?.[0]?.friendRequest;

describe("useFriendRequest on search results", () => {
  beforeEach(() => jest.resetAllMocks());

  it("send flips the row to sent at once and back on error", async () => {
    let reject!: (e: Error) => void;
    jest.mocked(actions).sendFriendRequest.mockReturnValue(new Promise((_, r) => (reject = r)));
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useFriendRequest("u1"), { wrapper });
    await act(async () => {
      result.current.send();
    });
    expect(requestOf(queryClient)).toBe("sent");
    await act(async () => {
      reject(new Error("nope"));
    });
    expect(requestOf(queryClient)).toBe("none");
  });

  it("accept moves the person to Amigos and rolls back on error", async () => {
    let reject!: (e: Error) => void;
    jest.mocked(actions).acceptFriendRequest.mockReturnValue(new Promise((_, r) => (reject = r)));
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useFriendRequest("u1"), { wrapper });
    await act(async () => {
      result.current.accept();
    });
    expect(queryClient.getQueryData<{ id: string }[]>(userSearchKey("cami"))?.map((r) => r.id)).toEqual(["u2"]);
    expect(queryClient.getQueryData(friendsKey)).toEqual([
      { id: "f1", name: "F", username: "f", avatarUrl: null, bio: null },
      { id: "u1", name: "Cami", username: "cami", avatarUrl: null, bio: null },
    ]);
    await act(async () => {
      reject(new Error("nope"));
    });
    expect(queryClient.getQueryData<{ id: string }[]>(userSearchKey("cami"))?.map((r) => r.id)).toEqual(["u1", "u2"]);
    expect(queryClient.getQueryData<{ id: string }[]>(friendsKey)?.map((f) => f.id)).toEqual(["f1"]);
  });

  it("does not add someone already in Amigos", async () => {
    jest.mocked(actions).acceptFriendRequest.mockResolvedValue(undefined as never);
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(friendsKey, [{ id: "u1", name: "Cami", username: "cami", avatarUrl: null, bio: null }]);
    const { result } = await renderHook(() => useFriendRequest("u1"), { wrapper });
    await act(async () => {
      result.current.accept();
    });
    expect(queryClient.getQueryData<unknown[]>(friendsKey)).toHaveLength(1);
  });

  it("onSettled invalidates the user searches", async () => {
    jest.mocked(actions).sendFriendRequest.mockResolvedValue(undefined as never);
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useFriendRequest("u1"), { wrapper });
    await act(async () => {
      result.current.send();
    });
    expect(queryClient.getQueryState(userSearchKey("cami"))?.isInvalidated).toBe(true);
  });
});

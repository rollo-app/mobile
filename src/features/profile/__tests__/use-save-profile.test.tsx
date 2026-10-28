import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import { meKey } from "@/features/auth/actions";
import * as friendLink from "@/features/friends/handle-friend-link";
import * as actions from "../actions";
import { useSaveProfile } from "../use-save-profile";

jest.mock("../actions");
jest.mock("@/features/friends/handle-friend-link");

const me = { id: "u1", email: "a@b.c", name: "Old", username: "old", bio: null };

function setup() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  queryClient.setQueryData(meKey, me);
  queryClient.setQueryData(["trip", "t1"], {});
  queryClient.setQueryData(["feed", "t1"], {});
  return { queryClient, wrapper };
}

describe("useSaveProfile", () => {
  beforeEach(() => jest.resetAllMocks());

  it("runs beforeApply after the server saved and before the cache changes, then updates me and invalidates trips and feeds", async () => {
    jest.mocked(actions).updateProfile.mockResolvedValue({ ...me, name: "New", username: "new", bio: "hi" } as never);
    const { queryClient, wrapper } = setup();
    let nameInBeforeApply: unknown;
    const beforeApply = jest.fn(async () => {
      nameInBeforeApply = (queryClient.getQueryData(meKey) as { name: string }).name;
    });
    const { result } = await renderHook(() => useSaveProfile(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ changes: { name: "New", username: "new", bio: "hi" }, beforeApply });
    });
    expect(actions.updateProfile).toHaveBeenCalledWith({ name: "New", username: "new", bio: "hi" });
    expect(nameInBeforeApply).toBe("Old");
    expect(queryClient.getQueryData(meKey)).toMatchObject({ name: "New", username: "new", bio: "hi" });
    expect(queryClient.getQueryState(["trip", "t1"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["feed", "t1"])?.isInvalidated).toBe(true);
  });

  it("claims a typed friend code before saving, and a bad code stops the save", async () => {
    jest.mocked(friendLink).stashFriendCode.mockRejectedValue(new Error("Código incorrecto o vencido"));
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useSaveProfile(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ changes: { name: "New", username: "new" }, friendCode: "XYZ" }).catch(() => {});
    });
    expect(friendLink.stashFriendCode).toHaveBeenCalledWith("XYZ");
    expect(actions.updateProfile).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(meKey)).toEqual(me);
  });

  it("with no changes it only stashes the code and touches nothing else", async () => {
    jest.mocked(friendLink).stashFriendCode.mockResolvedValue(undefined);
    const { queryClient, wrapper } = setup();
    const beforeApply = jest.fn();
    const { result } = await renderHook(() => useSaveProfile(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ changes: null, friendCode: "XYZ", beforeApply });
    });
    expect(actions.updateProfile).not.toHaveBeenCalled();
    expect(beforeApply).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(["trip", "t1"])?.isInvalidated).toBe(false);
  });

  it("keeps the cache when the update fails", async () => {
    jest.mocked(actions).updateProfile.mockRejectedValue(new Error("nope"));
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useSaveProfile(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ changes: { name: "New", username: "new" } }).catch(() => {});
    });
    expect(queryClient.getQueryData(meKey)).toEqual(me);
  });
});

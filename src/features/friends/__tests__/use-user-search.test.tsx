import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import * as actions from "../actions";
import { useUserSearch } from "../use-user-search";

jest.mock("../actions");

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
const row = (id: string) => ({ id, name: id, username: id, avatarUrl: null, mutualCount: 0, friendRequest: "none" as const });

describe("useUserSearch", () => {
  beforeEach(() => jest.resetAllMocks());

  it("does not call the API below 2 characters", async () => {
    const { result } = await renderHook(() => useUserSearch("c"), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450));
    });
    expect(actions.searchUsers).not.toHaveBeenCalled();
    expect(result.current.results).toBeNull();
  });

  it("calls searchUsers with the normalized text after the pause", async () => {
    jest.mocked(actions).searchUsers.mockResolvedValue([row("a")]);
    const { result, rerender } = await renderHook((p: { q: string }) => useUserSearch(p.q), { wrapper, initialProps: { q: "" } });
    await rerender({ q: "@Cámi" });
    expect(actions.searchUsers).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.results).toEqual([row("a")]));
    expect(actions.searchUsers).toHaveBeenCalledWith("cami");
    expect(result.current.query).toBe("cami");
  });

  it("keeps previous results while the next query loads", async () => {
    let resolveSecond: (v: ReturnType<typeof row>[]) => void = () => {};
    jest
      .mocked(actions)
      .searchUsers.mockResolvedValueOnce([row("a")])
      .mockReturnValueOnce(new Promise((r) => (resolveSecond = r)));
    const { result, rerender } = await renderHook((p: { q: string }) => useUserSearch(p.q), { wrapper, initialProps: { q: "ca" } });
    await waitFor(() => expect(result.current.results).toEqual([row("a")]));
    await rerender({ q: "cam" });
    await waitFor(() => expect(result.current.query).toBe("cam"));
    expect(result.current.results).toEqual([row("a")]);
    await act(async () => {
      resolveSecond([row("b")]);
    });
    await waitFor(() => expect(result.current.results).toEqual([row("b")]));
  });

  it("never sends more than 30 characters", async () => {
    jest.mocked(actions).searchUsers.mockResolvedValue([row("a")]);
    const { result } = await renderHook(() => useUserSearch("x".repeat(45)), { wrapper });
    await waitFor(() => expect(result.current.results).toEqual([row("a")]));
    expect(actions.searchUsers).toHaveBeenCalledWith("x".repeat(30));
  });

  it("exposes the error message", async () => {
    jest.mocked(actions).searchUsers.mockRejectedValue(new Error("boom"));
    const { result } = await renderHook(() => useUserSearch("cami"), { wrapper });
    await waitFor(() => expect(result.current.error).toBe("boom"));
  });
});

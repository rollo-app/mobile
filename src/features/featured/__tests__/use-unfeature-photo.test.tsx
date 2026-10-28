import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import { feedKey } from "@/features/trips/use-feed";
import * as actions from "../actions";
import { featuredKey } from "../use-featured";
import { useUnfeaturePhoto } from "../use-unfeature-photo";

jest.mock("../actions");

function setup() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  queryClient.setQueryData(featuredKey("u1"), [{ mediaId: "a" }, { mediaId: "b" }]);
  queryClient.setQueryData(feedKey("t1"), { items: [] });
  return { queryClient, wrapper };
}

describe("useUnfeaturePhoto", () => {
  beforeEach(() => jest.resetAllMocks());

  it("removes the photo from the cached list, invalidates the feeds and calls onSuccess", async () => {
    jest.mocked(actions).unfeatureMedia.mockResolvedValue(undefined);
    const { queryClient, wrapper } = setup();
    const onSuccess = jest.fn();
    const { result } = await renderHook(() => useUnfeaturePhoto("u1"), { wrapper });
    await act(async () => {
      result.current.unfeature("a", onSuccess);
    });
    expect(actions.unfeatureMedia).toHaveBeenCalledWith("a");
    expect(queryClient.getQueryData<{ mediaId: string }[]>(featuredKey("u1"))?.map((p) => p.mediaId)).toEqual(["b"]);
    expect(queryClient.getQueryState(feedKey("t1"))?.isInvalidated).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
  });

  it("exposes the server's message with the photo that failed and keeps the list", async () => {
    jest.mocked(actions).unfeatureMedia.mockRejectedValue(new Error("nope"));
    const { queryClient, wrapper } = setup();
    const onSuccess = jest.fn();
    const { result } = await renderHook(() => useUnfeaturePhoto("u1"), { wrapper });
    await act(async () => {
      result.current.unfeature("a", onSuccess);
    });
    await waitFor(() => expect(result.current.error).toEqual({ mediaId: "a", message: "nope" }));
    expect(queryClient.getQueryData<unknown[]>(featuredKey("u1"))).toHaveLength(2);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("ignores a second call while the first is pending", async () => {
    let finish: () => void = () => {};
    jest.mocked(actions).unfeatureMedia.mockReturnValue(new Promise<void>((r) => (finish = r)));
    const { wrapper } = setup();
    const { result } = await renderHook(() => useUnfeaturePhoto("u1"), { wrapper });
    await act(async () => {
      result.current.unfeature("a");
      result.current.unfeature("b");
    });
    expect(actions.unfeatureMedia).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });
});

import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import * as tripActions from "@/features/trips/actions";
import { feedKey } from "@/features/trips/use-feed";
import { tripKey } from "@/features/trips/use-trip-detail";
import { useRemoveFeedPhoto } from "../use-remove-feed-photo";

jest.mock("@/features/trips/actions");

function setup() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  queryClient.setQueryData(feedKey("t1"), { items: [] });
  queryClient.setQueryData(tripKey("t1"), {});
  return { queryClient, wrapper };
}

describe("useRemoveFeedPhoto", () => {
  beforeEach(() => jest.resetAllMocks());

  it("deletes the media and invalidates the roll's feed and detail", async () => {
    jest.mocked(tripActions).deleteMedia.mockResolvedValue(undefined);
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useRemoveFeedPhoto(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ mediaId: "m1", tripId: "t1" });
    });
    expect(tripActions.deleteMedia).toHaveBeenCalledWith("m1");
    expect(queryClient.getQueryState(feedKey("t1"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(tripKey("t1"))?.isInvalidated).toBe(true);
  });

  it("leaves the cache alone when the delete fails", async () => {
    jest.mocked(tripActions).deleteMedia.mockRejectedValue(new Error("nope"));
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useRemoveFeedPhoto(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ mediaId: "m1", tripId: "t1" }).catch(() => {});
    });
    expect(queryClient.getQueryState(feedKey("t1"))?.isInvalidated).toBe(false);
  });
});

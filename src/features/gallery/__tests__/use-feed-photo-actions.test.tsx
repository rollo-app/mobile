import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Alert } from "react-native";
import { createQueryClient } from "@/api/query-client";
import type { FeedPages } from "@/features/trips/actions";
import { feedKey } from "@/features/trips/use-feed";
import { feedIds, feedItem, feedPagesOf } from "@/test/feed";
import * as actions from "../actions";
import { useArchivePhoto } from "../use-archive-photo";
import { useDeletePhoto } from "../use-delete-photo";

jest.mock("../actions");
jest.mock("burnt", () => ({ alert: jest.fn() }));
jest.mock("expo-haptics", () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: "success" } }));

let client = createQueryClient();
beforeEach(() => {
  jest.resetAllMocks();
  client = createQueryClient();
  // The photo lives in the second page.
  client.setQueryData(feedKey("t1"), feedPagesOf([feedItem("a")], [feedItem("b", { featuredByMe: true, archived: false })]));
});
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const itemB = () => client.getQueryData<FeedPages>(feedKey("t1"))!.pages[1]!.items[0] as unknown as { archived: boolean; featuredByMe: boolean };

describe("useArchivePhoto", () => {
  it("archives optimistically in whichever page holds the photo (and drops your feature)", async () => {
    let finish!: () => void;
    jest.mocked(actions).archiveMedia.mockReturnValue(new Promise<void>((r) => (finish = r)) as never);
    const { result } = await renderHook(() => useArchivePhoto(), { wrapper });
    await act(async () => result.current({ id: "b" }, "t1", true));
    await waitFor(() => expect(itemB()).toMatchObject({ archived: true, featuredByMe: false }));
    await act(async () => finish());
  });

  it("puts the previous feed back if it fails", async () => {
    jest.mocked(actions).archiveMedia.mockRejectedValue(new Error("nope"));
    const { result } = await renderHook(() => useArchivePhoto(), { wrapper });
    await act(async () => result.current({ id: "b" }, "t1", true));
    await waitFor(() => expect(itemB()).toMatchObject({ archived: false, featuredByMe: true }));
  });
});

describe("useDeletePhoto", () => {
  it("takes the photo out of its page right away and refetches the feed", async () => {
    jest.mocked(actions).deleteMedia.mockResolvedValue(undefined);
    jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => buttons!.find((b) => b.text === "Eliminar")!.onPress!());
    const { result } = await renderHook(() => useDeletePhoto(), { wrapper });
    await act(async () => {
      expect(await result.current.confirmDelete({ id: "b" }, "t1")).toBe(true);
    });
    expect(feedIds(client.getQueryData<FeedPages>(feedKey("t1")))).toEqual(["a"]);
    expect(client.getQueryState(feedKey("t1"))?.isInvalidated).toBe(true);
  });
});

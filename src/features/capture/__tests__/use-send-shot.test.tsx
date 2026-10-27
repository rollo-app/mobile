import { setSessionUserId } from "@/storage/session-user";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Crypto from "expo-crypto";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import { memoryDb } from "@/test/sqlite-memory";
import { createQueue, type Queue } from "../queue";
import * as media from "../media";
import { getQueue } from "../store";
import { syncQueue } from "../sync";
import { pendingKey } from "../use-pending-count";
import { pendingItemsKey } from "../use-pending-items";
import { useSendShot } from "../use-send-shot";

jest.mock("../media");
jest.mock("../store", () => ({ getQueue: jest.fn() }));
jest.mock("../sync", () => ({ syncQueue: jest.fn(async () => {}) }));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn(() => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa") }));

const photo = { uri: "file:///cache/IMG_1.jpg", width: 4000, height: 3000 };
const prepared = {
  originalUri: "file:///docs/o.jpg",
  thumbUri: "file:///docs/t.jpg",
  width: 10,
  height: 10,
  sizeBytes: 5,
  durationS: null,
  thumbhash: null,
};
let queue: Queue;

beforeEach(async () => {
  queue = await createQueue(memoryDb());
  await setSessionUserId("u1");
  jest.mocked(getQueue).mockResolvedValue(queue);
  jest.mocked(media.prepareMedia).mockResolvedValue(prepared);
  jest.mocked(syncQueue).mockClear();
});

function setup() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, wrapper };
}

const input = {
  tripId: "t1",
  photo,
  takenAt: Date.UTC(2027, 0, 5, 15),
  timeZone: "America/Argentina/Buenos_Aires",
  caption: "  hola  ",
  author: "Juani",
  fix: Promise.resolve({ lat: 1, lng: 2, accuracyM: 3 }),
};

describe("useSendShot", () => {
  it("enqueues the shot with a trimmed caption and its fix, refreshes pending and kicks the sync", async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(pendingKey("t1"), 0);
    queryClient.setQueryData(pendingItemsKey("t1"), []);
    const { result } = await renderHook(() => useSendShot(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    const [item] = await queue.pendingForTrip("u1", "t1");
    expect(item).toMatchObject({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", type: "photo", caption: "hola", lat: 1, lng: 2, day: "2027-01-05" });
    expect(queryClient.getQueryState(pendingKey("t1"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(pendingItemsKey("t1"))?.isInvalidated).toBe(true);
    expect(syncQueue).toHaveBeenCalled();
  });

  it("stores a null caption when it is blank", async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(() => useSendShot(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ ...input, caption: "   ", fix: null });
    });
    const [item] = await queue.pendingForTrip("u1", "t1");
    expect(item).toMatchObject({ caption: null, lat: null });
  });

  it("with momentDay and a selfie, enqueues the main and then the selfie paired with it", async () => {
    jest
      .mocked(Crypto.randomUUID)
      .mockReturnValueOnce("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
      .mockReturnValueOnce("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    const selfieAsset = { uri: "file:///cache/SELFIE.jpg", width: 1500, height: 2000 };
    const { wrapper } = setup();
    const { result } = await renderHook(() => useSendShot(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        ...input,
        momentDay: "2027-01-05",
        selfie: { photo: selfieAsset, takenAt: input.takenAt + 4000, facing: "front" },
      });
    });
    const items = await queue.pending("u1");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", momentDay: "2027-01-05", pairedWith: null });
    expect(items[1]).toMatchObject({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      momentDay: "2027-01-05",
      pairedWith: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      takenAt: input.takenAt + 4000,
    });
    expect(jest.mocked(media.prepareMedia).mock.calls.at(-1)?.[0]).toBe(selfieAsset);
    expect(jest.mocked(media.prepareMedia).mock.calls.at(-1)?.[3]).toEqual({ maxDimension: 1080 });
    expect(jest.mocked(media.prepareMedia).mock.calls.at(-2)?.[3]).toBeUndefined();
  });

  it("the 1080 px cap follows the camera, not the role: a front main is capped and a back linked image is not", async () => {
    const linked = { uri: "file:///cache/BACK.jpg", width: 1500, height: 2000 };
    const { wrapper } = setup();
    const { result } = await renderHook(() => useSendShot(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        ...input,
        facing: "front",
        momentDay: "2027-01-05",
        selfie: { photo: linked, takenAt: input.takenAt + 4000, facing: "back" },
      });
    });
    const calls = jest.mocked(media.prepareMedia).mock.calls;
    expect(calls.at(-2)?.[3]).toEqual({ maxDimension: 1080 });
    expect(calls.at(-1)?.[0]).toBe(linked);
    expect(calls.at(-1)?.[3]).toBeUndefined();
  });

  it("when the selfie preparation fails, nothing is enqueued and the mutation errors", async () => {
    jest.mocked(media.prepareMedia).mockResolvedValueOnce(prepared).mockRejectedValueOnce(new Error("selfie boom"));
    const selfieAsset = { uri: "file:///cache/SELFIE.jpg", width: 1500, height: 2000 };
    const { wrapper } = setup();
    const { result } = await renderHook(() => useSendShot(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ ...input, momentDay: "2027-01-05", selfie: { photo: selfieAsset, takenAt: input.takenAt + 4000 } }),
      ).rejects.toThrow("selfie boom");
    });
    expect(await queue.pendingForTrip("u1", "t1")).toEqual([]);
    expect(syncQueue).not.toHaveBeenCalled();
  });

  it("surfaces the error and does not sync when preparing fails", async () => {
    jest.mocked(media.prepareMedia).mockRejectedValue(new Error("boom"));
    const { wrapper } = setup();
    const { result } = await renderHook(() => useSendShot(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toThrow("boom");
    });
    await waitFor(() => expect(result.current.error?.message).toBe("boom"));
    expect(syncQueue).not.toHaveBeenCalled();
  });
});

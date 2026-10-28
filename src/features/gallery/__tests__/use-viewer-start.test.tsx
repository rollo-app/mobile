import { renderHook, waitFor } from "@testing-library/react-native";
import type { RevealedPhoto } from "@/features/media/revealed";
import { useViewerStart } from "../use-viewer-start";

const p = (id: string) => ({ id }) as RevealedPhoto;

describe("useViewerStart", () => {
  it("starts at the photo's index without refetching", async () => {
    const refetch = jest.fn(async () => {});
    const { result } = await renderHook(() => useViewerStart([p("a"), p("b")], "b", "t1", false, refetch));
    expect(result.current).toEqual({ startIndex: 1, missing: false, notFound: false });
    expect(refetch).not.toHaveBeenCalled();
  });

  it("asks the server once when the photo is missing, then reports not found", async () => {
    const refetch = jest.fn(async () => {});
    const { result } = await renderHook(() => useViewerStart([p("a")], "zzz", "t1", false, refetch));
    expect(result.current.missing).toBe(true);
    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("locks the start once found, even if the list changes after", async () => {
    const refetch = jest.fn(async () => {});
    let photos = [p("a")];
    const { result, rerender } = await renderHook(() => useViewerStart(photos, "b", "t1", false, refetch));
    expect(result.current.startIndex).toBeNull();
    photos = [p("a"), p("b")];
    await rerender({});
    expect(result.current.startIndex).toBe(1);
    photos = [p("x"), p("a"), p("b")];
    await rerender({});
    expect(result.current.startIndex).toBe(1);
  });

  it("does not refetch without a trip", async () => {
    const refetch = jest.fn(async () => {});
    await renderHook(() => useViewerStart([], "a", undefined, false, refetch));
    expect(refetch).not.toHaveBeenCalled();
  });
});

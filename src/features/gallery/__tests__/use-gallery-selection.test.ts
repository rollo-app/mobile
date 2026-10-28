import { act, renderHook } from "@testing-library/react-native";
import type { RevealedPhoto } from "@/features/media/revealed";
import { useGallerySelection } from "../use-gallery-selection";

const photos = ["a", "b", "c"].map((id) => ({ id }) as RevealedPhoto);

describe("useGallerySelection", () => {
  it("starts idle and enters selection mode", async () => {
    const { result } = await renderHook(() => useGallerySelection(photos));
    expect(result.current.selecting).toBe(false);
    await act(async () => result.current.start());
    expect(result.current.selecting).toBe(true);
  });

  it("toggles a photo in and out", async () => {
    const { result } = await renderHook(() => useGallerySelection(photos));
    await act(async () => result.current.toggle("a"));
    expect([...result.current.selected]).toEqual(["a"]);
    await act(async () => result.current.toggle("a"));
    expect(result.current.selected.size).toBe(0);
  });

  it("selects all shown photos and then clears them", async () => {
    const { result } = await renderHook(() => useGallerySelection(photos));
    await act(async () => result.current.toggleAll());
    expect(result.current.allSelected).toBe(true);
    expect(result.current.selected.size).toBe(3);
    await act(async () => result.current.toggleAll());
    expect(result.current.selected.size).toBe(0);
  });

  it("is never all-selected with nothing shown", async () => {
    const { result } = await renderHook(() => useGallerySelection([]));
    expect(result.current.allSelected).toBe(false);
  });

  it("stop leaves selection mode and clears the selection", async () => {
    const { result } = await renderHook(() => useGallerySelection(photos));
    await act(async () => result.current.start());
    await act(async () => result.current.toggle("b"));
    await act(async () => result.current.stop());
    expect(result.current.selecting).toBe(false);
    expect(result.current.selected.size).toBe(0);
  });
});

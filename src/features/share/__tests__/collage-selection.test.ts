import { act, renderHook } from "@testing-library/react-native";
import type { RevealedPhoto } from "@/features/media/revealed";
import { pickCollage } from "../collage";
import { collagePhotos, getCollageSelection, setCollageSelection, toggleSelection, useCollageSelection } from "../collage-selection";

const photo = (id: string) => ({ id, shareable: true }) as RevealedPhoto;
const photos = (n: number) => Array.from({ length: n }, (_, i) => photo(`p${i}`));
const ids = (list: RevealedPhoto[]) => list.map((p) => p.id);

describe("toggleSelection", () => {
  it("appends a new id", () => {
    expect(toggleSelection(["a"], "b")).toEqual({ selection: ["a", "b"], full: false });
  });

  it("removes a selected id and keeps the order of the rest", () => {
    expect(toggleSelection(["a", "b", "c"], "b")).toEqual({ selection: ["a", "c"], full: false });
  });

  it("returns the selection unchanged and full at the max", () => {
    const eight = ["1", "2", "3", "4", "5", "6", "7", "8"];
    expect(toggleSelection(eight, "9")).toEqual({ selection: eight, full: true });
  });

  it("still removes when full", () => {
    const eight = ["1", "2", "3", "4", "5", "6", "7", "8"];
    expect(toggleSelection(eight, "8").selection).toHaveLength(7);
  });
});

describe("collagePhotos", () => {
  it("keeps the selection order", () => {
    expect(ids(collagePhotos(photos(5), ["p3", "p0", "p2"], 1))).toEqual(["p3", "p0", "p2"]);
  });

  it("skips ids that are not candidates", () => {
    expect(ids(collagePhotos(photos(3), ["gone", "p1"], 1))).toEqual(["p1"]);
  });

  it("falls back to the random pick when the selection is empty or all invalid", () => {
    const list = photos(10);
    expect(collagePhotos(list, [], 7)).toEqual(pickCollage(list, 7));
    expect(collagePhotos(list, ["x", "y"], 7)).toEqual(pickCollage(list, 7));
  });
});

describe("collage selection store", () => {
  it("sets and gets per trip, empty by default", () => {
    expect(getCollageSelection("t1")).toEqual([]);
    setCollageSelection("t1", ["a", "b"]);
    expect(getCollageSelection("t1")).toEqual(["a", "b"]);
    expect(getCollageSelection("t2")).toEqual([]);
    setCollageSelection("t1", []);
    expect(getCollageSelection("t1")).toEqual([]);
  });

  it("the hook follows updates", async () => {
    const { result } = await renderHook(() => useCollageSelection("t3"));
    expect(result.current).toEqual([]);
    await act(async () => setCollageSelection("t3", ["z"]));
    expect(result.current).toEqual(["z"]);
    await act(async () => setCollageSelection("t3", []));
  });
});

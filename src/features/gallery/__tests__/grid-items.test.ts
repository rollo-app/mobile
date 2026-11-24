import type { RevealedPhoto } from "@/features/media/revealed";
import type { Chapter } from "../chapters";
import { diaryItems, gridItems } from "../grid-items";

const photo = (id: string, day: string) => ({ id, day }) as RevealedPhoto;

describe("gridItems", () => {
  it("numbers each photo's column within its day, restarting after a header", () => {
    const items = gridItems(
      ["a", "b", "c", "d"].map((id) => photo(id, "2027-01-12")).concat(photo("e", "2027-01-13")),
      3,
    );
    expect(items.flatMap((i) => (i.kind === "photo" ? [[i.photo.id, i.column]] : []))).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
      ["d", 0],
      ["e", 0],
    ]);
  });

  it("returns nothing for no photos", () => {
    expect(gridItems([], 3)).toEqual([]);
  });

  it("puts a header before each day's photos, in order", () => {
    const items = gridItems([photo("a", "2027-01-12"), photo("b", "2027-01-12"), photo("c", "2027-01-13")], 3);
    expect(items.map((i) => (i.kind === "header" ? `H:${i.title}` : i.photo.id))).toEqual([
      "H:Martes 12 de enero",
      "a",
      "b",
      "H:Miércoles 13 de enero",
      "c",
    ]);
  });

  it("gives every item a unique stable key", () => {
    const items = gridItems([photo("a", "2027-01-12"), photo("b", "2027-01-13")], 3);
    expect(items.map((i) => i.key)).toEqual(["header:2027-01-12", "photo:a", "header:2027-01-13", "photo:b"]);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });
});

const rp = (id: string, extra: Partial<RevealedPhoto> = {}) =>
  ({ id, type: "photo", archived: false, likeCount: 0, caption: null, ...extra }) as RevealedPhoto;
const chapter = (key: string, photos: RevealedPhoto[]): Chapter => ({ key, kicker: null, title: key, photos, placeable: true });
const ids = (n: number, prefix = "p") => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
const label = (i: ReturnType<typeof diaryItems>[number]) => (i.kind === "chapter" ? `C:${i.chapter.key}` : `${i.kind[0]}:${i.photo.id}`);

describe("diaryItems", () => {
  it("starts each chapter with its header and hero", () => {
    const photos = ids(5).map((id) => rp(id, { likeCount: id === "p3" ? 9 : 0 }));
    const items = diaryItems([chapter("c1", photos)], 3);
    expect(items.slice(0, 2).map(label)).toEqual(["C:c1", "h:p3"]);
  });

  it("leaves the hero out of the grid", () => {
    const photos = ids(5).map((id) => rp(id, { likeCount: id === "p3" ? 9 : 0 }));
    const items = diaryItems([chapter("c1", photos)], 3);
    expect(items.filter((i) => i.kind === "photo").map((i) => i.photo.id)).toEqual(["p1", "p2", "p4", "p5"]);
  });

  it("puts the first quote after the first full row", () => {
    const photos = ids(8).map((id) => rp(id, { caption: id === "p2" ? "hola" : null, likeCount: id === "p8" ? 5 : 0 }));
    const items = diaryItems([chapter("c1", photos)], 3);
    expect(items.map(label)).toEqual(["C:c1", "h:p8", "p:p1", "p:p2", "p:p3", "q:p2", "p:p4", "p:p5", "p:p6", "p:p7"]);
  });

  it("restarts columns after a quote", () => {
    // p1 is the hero (first of equal likes), so the grid starts at p2.
    const photos = ids(8).map((id) => rp(id, { caption: id === "p1" ? "hola" : null }));
    const items = diaryItems([chapter("c1", photos)], 3);
    const cols = items.flatMap((i) => (i.kind === "photo" ? [[i.photo.id, i.column]] : []));
    expect(cols.slice(3, 6)).toEqual([["p5", 0], ["p6", 1], ["p7", 2]]);
  });

  it("a 2-photo chapter has no hero and its quote after the photos", () => {
    const photos = [rp("a", { caption: "x" }), rp("b")];
    const items = diaryItems([chapter("c1", photos)], 3);
    expect(items.map(label)).toEqual(["C:c1", "p:a", "p:b", "q:a"]);
  });

  it("keys are unique across chapters", () => {
    const a = ids(6, "a").map((id) => rp(id, { caption: "x" }));
    const b = ids(6, "b").map((id) => rp(id, { caption: "y" }));
    const items = diaryItems([chapter("c1", a), chapter("c2", b)], 3);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
    expect(items[0]!.key).toBe("chapter:c1");
  });

  it("returns nothing for no chapters", () => {
    expect(diaryItems([], 3)).toEqual([]);
  });
});

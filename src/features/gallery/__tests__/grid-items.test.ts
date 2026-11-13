import type { RevealedPhoto } from "@/features/media/revealed";
import { gridItems } from "../grid-items";

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

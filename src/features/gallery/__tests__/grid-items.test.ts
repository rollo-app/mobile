import type { RevealedPhoto } from "@/features/media/revealed";
import type { Chapter } from "../chapters";
import { diaryItems } from "../grid-items";

const photo = (id: string, day: string) => ({ id, day }) as RevealedPhoto;

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

  it("puts a quote photo in its own row, once, and out of the regular rows", () => {
    // p8 is the hero; p2 is the quote.
    const photos = ids(8).map((id) => rp(id, { caption: id === "p2" ? "hola" : null, likeCount: id === "p8" ? 5 : 0 }));
    const items = diaryItems([chapter("c1", photos)], 3);
    expect(items.filter((i) => i.kind !== "chapter" && i.photo.id === "p2")).toHaveLength(1);
    expect(items.filter((i) => i.kind === "photo").map((i) => i.photo.id)).not.toContain("p2");
  });

  it("fills the rows before the quote, pulling later photos up, and keeps the order", () => {
    const photos = ids(9).map((id) => rp(id, { caption: id === "p2" ? "hola" : null, likeCount: id === "p9" ? 5 : 0 }));
    const items = diaryItems([chapter("c1", photos)], 3);
    // The quote is p2 (natural place: after p1); the row above completes with p3 and p4.
    expect(items.map(label)).toEqual(["C:c1", "h:p9", "p:p1", "p:p3", "p:p4", "q:p2", "p:p5", "p:p6", "p:p7", "p:p8"]);
    const cols = items.flatMap((i) => (i.kind === "photo" ? [i.column] : []));
    expect(cols).toEqual([0, 1, 2, 0, 1, 2, 0]);
  });

  it("keeps a quote at a row boundary where it is", () => {
    const photos = ids(8).map((id) => rp(id, { caption: id === "p4" ? "hola" : null, likeCount: id === "p8" ? 5 : 0 }));
    const items = diaryItems([chapter("c1", photos)], 3);
    expect(items.map(label)).toEqual(["C:c1", "h:p8", "p:p1", "p:p2", "p:p3", "q:p4", "p:p5", "p:p6", "p:p7"]);
  });

  it("puts a quote at the start of the chapter when it is the first photo", () => {
    const photos = ids(5).map((id) => rp(id, { caption: id === "p1" ? "hola" : null, likeCount: id === "p5" ? 5 : 0 }));
    const items = diaryItems([chapter("c1", photos)], 3);
    expect(items.map(label)).toEqual(["C:c1", "h:p5", "q:p1", "p:p2", "p:p3", "p:p4"]);
  });

  it("every photo of the chapter appears in exactly one item", () => {
    const photos = ids(20).map((id, n) => rp(id, { caption: n % 3 === 0 ? "x" : null, likeCount: n % 7 }));
    const items = diaryItems([chapter("c1", photos)], 3);
    const seen = items.flatMap((i) => (i.kind === "chapter" ? [] : [i.photo.id])).sort();
    expect(seen).toEqual(photos.map((p) => p.id).sort());
    expect(items.filter((i) => i.kind === "quote")).toHaveLength(2);
  });

  it("only the last regular row can be incomplete", () => {
    const photos = ids(20).map((id, n) => rp(id, { caption: n === 3 || n === 11 ? "x" : null, likeCount: id === "p1" ? 9 : 0 }));
    const items = diaryItems([chapter("c1", photos)], 3);
    const runs: number[] = [];
    let run = 0;
    for (const i of items) {
      if (i.kind === "photo") run++;
      else if (run) { runs.push(run); run = 0; }
    }
    if (run) runs.push(run);
    runs.slice(0, -1).forEach((n) => expect(n % 3).toBe(0));
  });

  it("a quote after the last photos goes at the end", () => {
    const photos = [rp("a"), rp("b"), rp("c", { caption: "x" })];
    expect(diaryItems([chapter("c1", photos)], 3).map(label)).toEqual(["C:c1", "p:a", "p:b", "q:c"]);
  });

  it("two quotes that would be adjacent: only the first stays a quote", () => {
    const photos = [rp("a", { caption: "x" }), rp("b", { caption: "y" }), rp("c")];
    const items = diaryItems([chapter("c1", photos)], 3);
    expect(items.map(label)).toEqual(["C:c1", "q:a", "p:b", "p:c"]);
  });

  it("two quotes with a full row between them both stay", () => {
    const photos = ids(8).map((id) => rp(id, { caption: id === "p1" || id === "p5" ? "x" : null, likeCount: id === "p8" ? 3 : 0 }));
    const items = diaryItems([chapter("c1", photos)], 3);
    expect(items.map(label)).toEqual(["C:c1", "h:p8", "q:p1", "p:p2", "p:p3", "p:p4", "q:p5", "p:p6", "p:p7"]);
  });

  it("the hero wins when it is also captioned: it is not a quote", () => {
    const photos = ids(5).map((id) => rp(id, { caption: id === "p3" ? "hola" : null, likeCount: id === "p3" ? 9 : 0 }));
    const items = diaryItems([chapter("c1", photos)], 3);
    expect(items.filter((i) => i.kind === "quote")).toHaveLength(0);
    expect(items.filter((i) => i.kind !== "chapter" && i.photo.id === "p3")).toHaveLength(1);
    expect(items[1]).toMatchObject({ kind: "hero" });
  });

  it("a 1-photo chapter with a caption is just its quote row", () => {
    expect(diaryItems([chapter("c1", [rp("a", { caption: "x" })])], 3).map(label)).toEqual(["C:c1", "q:a"]);
  });

  it("a 3-photo chapter with a caption in the middle pulls the next photo up before its quote", () => {
    const photos = [rp("a"), rp("b", { caption: "x" }), rp("c")];
    expect(diaryItems([chapter("c1", photos)], 3).map(label)).toEqual(["C:c1", "p:a", "p:c", "q:b"]);
  });

  it("quote rows alternate left and right across chapters, in order", () => {
    const a = [rp("a1", { caption: "x" }), rp("a2")];
    const b = [rp("b1", { caption: "x" }), rp("b2"), rp("b3"), rp("b4"), rp("b5", { caption: "y" }), rp("b6"), rp("b7"), rp("b8", { likeCount: 5 })];
    const sides = diaryItems([chapter("c1", a), chapter("c2", b)], 3).flatMap((i) => (i.kind === "quote" ? [[i.photo.id, i.side]] : []));
    expect(sides).toEqual([["a1", "left"], ["b1", "right"], ["b5", "left"]]);
  });

  it("a chapter without quotes does not consume a turn", () => {
    const quoteless = [rp("n1"), rp("n2")];
    const sides = diaryItems([chapter("c1", [rp("a", { caption: "x" })]), chapter("c2", quoteless), chapter("c3", [rp("b", { caption: "x" })])], 3).flatMap(
      (i) => (i.kind === "quote" ? [i.side] : []),
    );
    expect(sides).toEqual(["left", "right"]);
  });

  it("keys are unique across chapters", () => {
    const a = ids(6, "a").map((id) => rp(id, { caption: "x" }));
    const b = ids(6, "b").map((id) => rp(id, { caption: "y" }));
    const items = diaryItems([chapter("c1", a), chapter("c2", b)], 3);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
    expect(items[0]!.key).toBe("chapter:c1");
  });

  it("a 2-photo chapter with 2 captions shows one quote", () => {
    const items = diaryItems([chapter("c1", [rp("a", { caption: "x" }), rp("b", { caption: "y" })])], 3);
    expect(items.filter((i) => i.kind === "quote")).toHaveLength(1);
  });

  it("a hero plus a 3-photo grid with 3 captions never has two quotes in a row", () => {
    const photos = ids(4).map((id) => rp(id, { caption: "c", likeCount: id === "p1" ? 9 : 0 }));
    const kinds = diaryItems([chapter("c1", photos)], 3).map((i) => i.kind);
    expect(kinds.filter((k) => k === "quote")).toHaveLength(1);
    kinds.forEach((k, n) => expect(k === "quote" && kinds[n + 1] === "quote").toBe(false));
  });

  it("returns nothing for no chapters", () => {
    expect(diaryItems([], 3)).toEqual([]);
  });
});

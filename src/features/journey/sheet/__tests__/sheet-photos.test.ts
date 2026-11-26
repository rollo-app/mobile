import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { HIGHLIGHT_MAX, nextState, SHEET_MAX, sheetBlocked, sheetCandidates, sheetCounter, sheetPick, sheetStates } from "../sheet-photos";

const photo = (id: string, over: Partial<RevealedPhoto> = {}): RevealedPhoto =>
  ({
    id,
    type: "photo",
    takenAt: 1_000,
    day: "2027-01-12",
    lat: null,
    lng: null,
    shareable: true,
    archived: false,
    likeCount: 0,
    author: { id: "m1", userId: "u1", name: "Ana", username: null, avatarUrl: null },
    ...over,
  }) as RevealedPhoto;

/** n photos p0..p(n-1) taken in order; likes by `likes(i)`. */
const many = (n: number, likes: (i: number) => number = () => 0) =>
  Array.from({ length: n }, (_, i) => photo(`p${i}`, { takenAt: 1_000 + i * 10, likeCount: likes(i) }));

const detail = (trip: Record<string, unknown> = {}): TripDetail => ({ trip: { type: "trip", featuringDisabled: false, revealed: true, ...trip } }) as unknown as TripDetail;

describe("sheetCandidates", () => {
  it("drops videos, archived and non-shareable photos, keeps one without coordinates", () => {
    const kept = photo("ok", { lat: null, lng: null });
    expect(sheetCandidates([kept, photo("v", { type: "video" }), photo("a", { archived: true }), photo("n", { shareable: false })])).toEqual([kept]);
  });
});

describe("sheetPick, no choices", () => {
  it("takes the 30 most liked, in time order, with 12 highlights in time order", () => {
    // Likes go up with the index, so the most liked are the last ones.
    const c = many(40, (i) => i);
    const { cells, highlights } = sheetPick(c, {});
    expect(cells).toHaveLength(SHEET_MAX);
    expect(cells.map((p) => p.id)).toEqual(c.slice(10).map((p) => p.id));
    expect(highlights).toHaveLength(HIGHLIGHT_MAX);
    expect(highlights).toEqual(c.slice(28).map((p) => p.id));
  });

  it("returns cells and highlights by time even when likes are in the opposite order", () => {
    const c = many(40, (i) => 100 - i);
    const { cells, highlights } = sheetPick(c, {});
    expect(cells.map((p) => p.takenAt)).toEqual([...cells.map((p) => p.takenAt)].sort((a, b) => a - b));
    expect(highlights).toEqual(c.slice(0, 12).map((p) => p.id));
  });

  it("picks by time, stably, when every photo has the same likes", () => {
    const c = many(40);
    const { cells, highlights } = sheetPick(c, {});
    expect(cells.map((p) => p.id)).toEqual(c.slice(0, 30).map((p) => p.id));
    expect(highlights).toEqual(c.slice(0, 12).map((p) => p.id));
  });
});

describe("sheetStates, hand choices", () => {
  it("never brings back a photo set out", () => {
    const c = many(40, (i) => 100 - i);
    const first = sheetPick(c, { p0: "out" });
    expect(first.cells.map((p) => p.id)).not.toContain("p0");
    expect(first.cells).toHaveLength(30);
    expect(first.cells.map((p) => p.id)).toContain("p30");
    const second = sheetPick(c, { p0: "out", p5: "out" });
    expect(second.cells.map((p) => p.id)).not.toContain("p0");
    expect(second.cells.map((p) => p.id)).not.toContain("p5");
    expect(second.cells).toHaveLength(30);
  });

  it("has nothing to refill with when there are few candidates", () => {
    const c = many(10);
    expect(sheetPick(c, { p0: "out", p1: "out", p2: "out" }).cells).toHaveLength(7);
  });

  it("uses only the hand-chosen highlights once there is one", () => {
    const c = many(40, (i) => 100 - i);
    const { highlights, cells } = sheetPick(c, { p35: "highlight" });
    expect(highlights).toEqual(["p35"]);
    expect(cells.map((p) => p.id)).toContain("p35");
  });

  it("puts a hand-chosen sheet photo in and pushes the least liked automatic one out", () => {
    const c = many(40, (i) => 100 - i);
    const { cells } = sheetPick(c, { p39: "sheet" });
    const ids = cells.map((p) => p.id);
    expect(cells).toHaveLength(30);
    expect(ids).toContain("p39");
    expect(ids).not.toContain("p29");
    expect(ids).toContain("p28");
  });

  it("keeps the earliest hand-chosen photos when there are more than the sheet holds", () => {
    const c = many(40);
    const choices = Object.fromEntries(c.slice(0, 35).map((p) => [p.id, "sheet" as const]));
    const states = sheetStates(c, choices);
    expect(Object.values(states).filter((s) => s !== "out")).toHaveLength(30);
    expect(states.p29).toBe("sheet");
    expect(states.p30).toBe("out");
  });

  it("falls back to sheet for hand highlights beyond the limit (earliest kept)", () => {
    const c = many(20);
    const choices = Object.fromEntries(c.slice(0, 14).map((p) => [p.id, "highlight" as const]));
    const states = sheetStates(c, choices);
    expect(states.p11).toBe("highlight");
    expect(states.p12).toBe("sheet");
    expect(states.p13).toBe("sheet");
  });

  it("ignores choices for ids that are not candidates", () => {
    const c = many(8);
    expect(sheetPick(c, { ghost: "highlight" }).highlights).toHaveLength(8);
  });
});

describe("nextState", () => {
  it("cycles sheet, highlight, out", () => {
    expect(nextState("sheet", 3)).toBe("highlight");
    expect(nextState("sheet", 12)).toBe("out");
    expect(nextState("highlight", 5)).toBe("out");
    expect(nextState("out", 5)).toBe("sheet");
  });
});

describe("sheetCounter", () => {
  const pick = (cells: number, highlights: number) => ({ cells: many(cells), highlights: many(highlights).map((p) => p.id) });
  it("pluralises", () => {
    expect(sheetCounter(pick(30, 8))).toBe("8 destacadas · 30 en la hoja");
    expect(sheetCounter(pick(1, 1))).toBe("1 destacada · 1 en la hoja");
    expect(sheetCounter(pick(6, 0))).toBe("0 destacadas · 6 en la hoja");
  });
});

describe("sheetBlocked", () => {
  it("says why there is no summary, or null", () => {
    expect(sheetBlocked(detail({ featuringDisabled: true }), 10)).toBe("private");
    expect(sheetBlocked(detail({ revealed: false }), 10)).toBe("unrevealed");
    expect(sheetBlocked(detail(), 5)).toBe("few");
    expect(sheetBlocked(detail({ type: "event" }), 6)).toBeNull();
  });
});

import { buildContactSheet } from "../contact-sheet";

const f = (takenAt: number, thumbhash: string | null) => ({ takenAt, thumbhash });

describe("buildContactSheet", () => {
  it("sorts newest to oldest, mixing uploaded and pending", () => {
    const sheet = buildContactSheet({
      feed: [f(10, "a"), f(30, "c")],
      pending: [f(20, "b"), f(40, "d")],
      total: 4,
    });
    expect(sheet.frames).toEqual(["d", "c", "b", "a"]);
    expect(sheet.rest).toBe(0);
  });

  it("leaves null where there is no thumbhash", () => {
    const sheet = buildContactSheet({ feed: [f(2, null), f(1, "a")], pending: [], total: 2 });
    expect(sheet.frames).toEqual([null, "a"]);
  });

  it("pads with null if the total is greater than what is known", () => {
    const sheet = buildContactSheet({ feed: [f(1, "a")], pending: [], total: 3 });
    expect(sheet.frames).toEqual(["a", null, null]);
  });

  it("limits to 18 frames and counts the rest", () => {
    const feed = Array.from({ length: 25 }, (_, i) => f(i, `h${i}`));
    const sheet = buildContactSheet({ feed, pending: [], total: 25 });
    expect(sheet.frames).toHaveLength(18);
    expect(sheet.frames[0]).toBe("h24");
    expect(sheet.rest).toBe(7);
  });

  it("with nothing in the roll there are no frames", () => {
    expect(buildContactSheet({ feed: [], pending: [], total: 0 })).toEqual({ frames: [], rest: 0 });
  });

  it("a limit below the total ignores the feed's excess", () => {
    const sheet = buildContactSheet({ feed: [f(1, "a"), f(2, "b")], pending: [], total: 1 });
    expect(sheet.frames).toEqual(["b"]);
  });
});

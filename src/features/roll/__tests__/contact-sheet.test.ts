import { buildContactSheet, newestEntered } from "../contact-sheet";

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
    expect(buildContactSheet({ feed: [], pending: [], total: 0 })).toEqual({ frames: [], keys: [], rest: 0 });
  });

  it("a limit below the total ignores the feed's excess", () => {
    const sheet = buildContactSheet({ feed: [f(1, "a"), f(2, "b")], pending: [], total: 1 });
    expect(sheet.frames).toEqual(["b"]);
  });
});

describe("buildContactSheet keys", () => {
  it("uses the item id when there is one, in frame order", () => {
    const sheet = buildContactSheet({
      feed: [{ id: "a", takenAt: 1, thumbhash: "a" }],
      pending: [{ id: "b", takenAt: 2, thumbhash: "b" }],
      total: 2,
    });
    expect(sheet.keys).toEqual(["b", "a"]);
  });

  it("falls back to takenAt and pads unknown frames by position", () => {
    const sheet = buildContactSheet({ feed: [f(5, "a")], pending: [], total: 2 });
    expect(sheet.keys).toEqual(["t5", "empty-1"]);
  });
});

describe("newestEntered", () => {
  it("is null on the first render", () => {
    expect(newestEntered(null, { keys: ["a"], total: 1 })).toBeNull();
  });

  it("returns the newest key when the total grew and it is new", () => {
    expect(newestEntered({ keys: ["a"], total: 1 }, { keys: ["b", "a"], total: 2 })).toBe("b");
  });

  it("is null for a re-render with the same photos", () => {
    expect(newestEntered({ keys: ["b", "a"], total: 2 }, { keys: ["b", "a"], total: 2 })).toBeNull();
  });

  it("is null when the total did not grow", () => {
    expect(newestEntered({ keys: ["a", "x"], total: 2 }, { keys: ["b", "a"], total: 2 })).toBeNull();
  });

  it("is null when the newest frame was already there", () => {
    expect(newestEntered({ keys: ["b", "a"], total: 2 }, { keys: ["b", "a", "c"], total: 3 })).toBeNull();
  });

  it("works when the sheet is capped and the total keeps growing", () => {
    expect(newestEntered({ keys: ["a", "b"], total: 20 }, { keys: ["n", "a"], total: 21 })).toBe("n");
  });
});

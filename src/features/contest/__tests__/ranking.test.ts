import type { ContestFinalist } from "../actions";
import { rankFinalists } from "../ranking";

const f = (mediaId: string, votes: number | null): ContestFinalist => ({
  mediaId,
  author: { userId: `u-${mediaId}`, name: mediaId, username: null, avatarUrl: null },
  thumbHash: null,
  width: null,
  height: null,
  thumbPath: "",
  displayPath: "",
  votes,
});

describe("rankFinalists", () => {
  it("orders by votes, ties share the place and the next skips", () => {
    const ranked = rankFinalists([f("d", 0), f("c", 6), f("b", 9), f("a", 9)]);
    expect(ranked.map((r) => r.finalist.mediaId)).toEqual(["a", "b", "c", "d"]);
    expect(ranked.map((r) => r.place)).toEqual([1, 1, 3, 4]);
    expect(ranked.map((r) => Number(r.share.toFixed(2)))).toEqual([1, 1, 0.67, 0]);
  });

  it("everyone at 0 is first with no share", () => {
    const ranked = rankFinalists([f("b", 0), f("a", 0)]);
    expect(ranked.map((r) => [r.finalist.mediaId, r.place, r.share])).toEqual([["a", 1, 0], ["b", 1, 0]]);
  });

  it("hidden counts (null) rank as 0 and an empty list is fine", () => {
    expect(rankFinalists([f("a", null), f("b", null)]).map((r) => r.place)).toEqual([1, 1]);
    expect(rankFinalists([])).toEqual([]);
  });
});

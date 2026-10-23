import { setLiked } from "../like-cache";

describe("setLiked", () => {
  it("likes an item and adds one to its count", () => {
    expect(setLiked({ likedByMe: false, likeCount: 2 }, true)).toEqual({ likedByMe: true, likeCount: 3 });
  });

  it("unlikes an item and takes one from its count, never below zero", () => {
    expect(setLiked({ likedByMe: true, likeCount: 3 }, false)).toEqual({ likedByMe: false, likeCount: 2 });
    expect(setLiked({ likedByMe: true, likeCount: 0 }, false)).toEqual({ likedByMe: false, likeCount: 0 });
  });

  it("leaves an item that already has that state as it is (no double count)", () => {
    const item = { likedByMe: true, likeCount: 3 };
    expect(setLiked(item, true)).toBe(item);
  });

  it("treats missing fields (videos, before the reveal) as not liked with no likes", () => {
    expect(setLiked({ id: "a" } as { id: string; likedByMe?: boolean; likeCount?: number }, true)).toEqual({ id: "a", likedByMe: true, likeCount: 1 });
  });
});

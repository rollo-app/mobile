import { likeHref } from "../likes-target";
import type { LikedPhoto } from "../actions";

const item = (source: LikedPhoto["source"]): LikedPhoto => ({
  mediaId: "m1",
  likedAt: 1,
  authorUserId: "u2",
  author: { id: "u2", name: "Cami", username: "cami", avatarUrl: null },
  thumbPath: "/x/thumb",
  thumbHash: null,
  source,
});

describe("likeHref", () => {
  it("opens the gallery viewer of the roll when you are a member", () => {
    expect(likeHref(item({ kind: "trip", tripId: "t1" }))).toBe("/photo/m1?tripId=t1");
  });

  it("opens the featured viewer of the profile that shows it otherwise", () => {
    expect(likeHref(item({ kind: "featured", userId: "u9" }))).toBe("/featured/u9/m1");
  });
});

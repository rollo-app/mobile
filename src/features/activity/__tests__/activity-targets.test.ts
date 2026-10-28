import type { FeaturedByItem, MyComment } from "../actions";
import { commentHref, featuredByHref } from "../activity-targets";

describe("commentHref", () => {
  it("opens the photo in its roll's gallery with the comments open", () => {
    const comment = { commentId: "c1", mediaId: "m1", tripId: "t1", text: "ja", createdAt: 1, thumbPath: "/x", thumbHash: null } satisfies MyComment;
    expect(commentHref(comment)).toBe("/photo/m1?tripId=t1&comments=1");
  });
});

describe("featuredByHref", () => {
  it("opens the photo on the profile of whoever featured it", () => {
    const item = {
      mediaId: "m1",
      user: { id: "u9", name: "Cami", username: "cami", avatarUrl: null, bio: null },
      featuredAt: 1,
      thumbPath: "/x",
      thumbHash: null,
    } satisfies FeaturedByItem;
    expect(featuredByHref(item)).toBe("/featured/u9/m1");
  });
});

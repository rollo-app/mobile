import { avatarSources, pinAvatarKey } from "../pin-avatars";
import { toFeatures, type MapItem } from "../features";

const item = (over: Partial<MapItem> = {}): MapItem => ({
  id: "m1",
  type: "photo",
  takenAt: 1_800_000_000_000,
  day: "2027-01-12",
  lat: -49.33,
  lng: -72.89,
  caption: null,
  durationS: null,
  thumbhash: null,
  authorId: "a1",
  authorName: "Cami",
  authorAvatarUrl: "/avatars/a1-v1.jpg",
  pending: false,
  ...over,
});

describe("pinAvatarKey", () => {
  it("changes when the author's photo changes", () => {
    expect(pinAvatarKey("a1", "/avatars/a1-v1.jpg")).not.toBe(pinAvatarKey("a1", "/avatars/a1-v2.jpg"));
  });

  it("differs between authors and is stable", () => {
    expect(pinAvatarKey("a1", "/x.jpg")).toBe(pinAvatarKey("a1", "/x.jpg"));
    expect(pinAvatarKey("a1", "/x.jpg")).not.toBe(pinAvatarKey("a2", "/x.jpg"));
  });
});

describe("avatarSources", () => {
  it("lists each author with a photo once", () => {
    const items = [item({ id: "1" }), item({ id: "2" }), item({ id: "3", authorId: "a2", authorAvatarUrl: "/avatars/a2.jpg" })];
    expect(avatarSources(items).map((s) => s.authorId)).toEqual(["a1", "a2"]);
  });

  it("skips authors without a photo", () => {
    expect(avatarSources([item({ authorAvatarUrl: null })])).toEqual([]);
  });

  it("carries the avatar path and the image key", () => {
    expect(avatarSources([item()])).toEqual([
      { authorId: "a1", avatarUrl: "/avatars/a1-v1.jpg", key: pinAvatarKey("a1", "/avatars/a1-v1.jpg") },
    ]);
  });
});

describe("toFeatures avatar", () => {
  const none = { day: null, authorId: null };

  it("has no avatar while the image is not ready", () => {
    expect(toFeatures([item()], none).features[0]!.properties.avatar).toBe("");
  });

  it("uses the image key once it is ready", () => {
    const key = pinAvatarKey("a1", "/avatars/a1-v1.jpg");
    expect(toFeatures([item()], none, new Set([key])).features[0]!.properties.avatar).toBe(key);
  });

  it("ignores a ready image generated for an older photo", () => {
    const old = pinAvatarKey("a1", "/avatars/a1-v0.jpg");
    expect(toFeatures([item()], none, new Set([old])).features[0]!.properties.avatar).toBe("");
  });

  it("has no avatar for authors without a photo", () => {
    const key = pinAvatarKey("a1", "/avatars/a1-v1.jpg");
    expect(toFeatures([item({ authorAvatarUrl: null })], none, new Set([key])).features[0]!.properties.avatar).toBe("");
  });
});

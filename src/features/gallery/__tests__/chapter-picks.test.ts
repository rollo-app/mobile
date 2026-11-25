import type { RevealedPhoto } from "@/features/media/revealed";
import { HERO_MIN_PHOTOS, MAX_QUOTES, pickHero, pickQuotes } from "../chapter-picks";

const photo = (id: string, extra: Partial<RevealedPhoto> = {}): RevealedPhoto => ({
  id,
  type: "photo",
  takenAt: 0,
  day: "2027-01-09",
  lat: null,
  lng: null,
  caption: null,
  durationS: null,
  width: null,
  height: null,
  thumbhash: null,
  author: { id: "m1", userId: "u-m1", name: "m1", username: null, avatarUrl: null },
  thumbPath: `/t/${id}`,
  originalPath: `/o/${id}`,
  displayPath: `/o/${id}`,
  originalAvailable: true,
  authorUserId: "u-m1",
  featuredByMe: false,
  featureBlocked: false,
  likeCount: 0,
  canFeature: true,
  likedByMe: false,
  commentCount: 0,
  momentDay: null,
  archived: false,
  selfie: null,
  groupIds: [],
  ...extra,
});

const filler = (n: number) => Array.from({ length: n }, (_, i) => photo(`f${i}`));

describe("pickHero", () => {
  it("exposes the thresholds", () => {
    expect(HERO_MIN_PHOTOS).toBe(4);
    expect(MAX_QUOTES).toBe(2);
  });

  it("no hero under 4 photos", () => {
    expect(pickHero([photo("a", { likeCount: 9 }), ...filler(2)])).toBeNull();
  });

  it("hero is the most liked photo", () => {
    const photos = [photo("a", { likeCount: 1 }), photo("b", { likeCount: 5 }), ...filler(2)];
    expect(pickHero(photos)?.id).toBe("b");
  });

  it("ties go to the first photo", () => {
    const photos = [photo("a", { likeCount: 3 }), photo("b", { likeCount: 3 }), ...filler(2)];
    expect(pickHero(photos)?.id).toBe("a");
  });

  it("a video or archived photo is never the hero", () => {
    const photos = [
      photo("v", { type: "video", likeCount: 99 }),
      photo("x", { archived: true, likeCount: 50 }),
      photo("ok", { likeCount: 1 }),
      photo("z"),
    ];
    expect(pickHero(photos)?.id).toBe("ok");
  });

  it("only videos means no hero", () => {
    const photos = Array.from({ length: 4 }, (_, i) => photo(`v${i}`, { type: "video" }));
    expect(pickHero(photos)).toBeNull();
  });
});

describe("pickQuotes", () => {
  it("quotes skip empty captions", () => {
    const photos = [
      photo("a", { caption: "  ", likeCount: 9 }),
      photo("b", { caption: null, likeCount: 9 }),
      photo("c", { caption: "hola" }),
    ];
    expect(pickQuotes(photos).map((p) => p.id)).toEqual(["c"]);
  });

  it("quotes are the 2 most liked, in time order", () => {
    const photos = [
      photo("a", { caption: "a", likeCount: 1 }),
      photo("b", { caption: "b", likeCount: 5 }),
      photo("c", { caption: "c", likeCount: 3 }),
      photo("d", { caption: "d", likeCount: 5 }),
    ];
    expect(pickQuotes(photos).map((p) => p.id)).toEqual(["b", "d"]);
    expect(pickQuotes(photos, 3).map((p) => p.id)).toEqual(["b", "c", "d"]);
  });
});

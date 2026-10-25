import type { RevealedPhoto } from "@/features/media/revealed";
import { buildStory } from "../story";
import { upcomingPhotos } from "../upcoming";

const photo = (id: string, iso: string): RevealedPhoto => ({
  id,
  type: "photo",
  takenAt: Date.parse(iso),
  day: iso.slice(0, 10),
  lat: null,
  lng: null,
  caption: null,
  durationS: null,
  width: null,
  height: null,
  thumbhash: null,
  author: { id: "m1", userId: "u-m1", name: "Cami", username: null, avatarUrl: null },
  thumbPath: "/t",
  originalPath: "/o",
  authorUserId: "u-m1",
  featuredByMe: false,
  featureBlocked: false,
  likeCount: 0,
  canFeature: true,
  likedByMe: false,
  commentCount: 0,
  momentDay: null,
  selfie: null,
});

describe("upcomingPhotos", () => {
  // 0 day, 1 a, 2 b, 3 day, 4 c, 5 outro
  const steps = buildStory(
    [photo("a", "2027-01-12T15:00:00Z"), photo("b", "2027-01-12T16:00:00Z"), photo("c", "2027-01-13T15:00:00Z")],
    "America/Argentina/Buenos_Aires",
  );

  it("returns the next two photos, crossing day cards", () => {
    expect(upcomingPhotos(steps, 1).map((p) => p.id)).toEqual(["b", "c"]);
  });

  it("returns what is left near the end and nothing after the last photo", () => {
    expect(upcomingPhotos(steps, 2).map((p) => p.id)).toEqual(["c"]);
    expect(upcomingPhotos(steps, 4)).toEqual([]);
  });

  it("from the first day card it starts with the first photos", () => {
    expect(upcomingPhotos(steps, 0, 3).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});

import type { RevealedPhoto } from "@/features/media/revealed";
import { buildStory } from "../story";
import { upcomingPhotos } from "../upcoming";

const photo = (id: string, iso: string): RevealedPhoto => ({
  shareable: false,
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
  displayPath: "/o",
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

describe("upcomingPhotos with credits", () => {
  it("warms the photos of the first credits from the last photo", () => {
    const cami = { id: "m1", userId: "u-m1", name: "Cami", username: null, avatarUrl: null };
    const fede = { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null };
    const photos = [
      photo("a", "2027-01-12T06:17:00Z"),
      photo("b", "2027-01-12T09:42:00Z"),
      ...Array.from({ length: 8 }, (_, i) => photo(`c${i}`, `2027-01-12T${String(15 + i).padStart(2, "0")}:00:00Z`)),
    ].map((p, i) => ({ ...p, author: i % 2 ? fede : cami }));
    const steps = buildStory(photos, "America/Argentina/Buenos_Aires", { credits: { blockedUserIds: new Set() } });
    const firstCredit = steps.findIndex((s) => s.kind === "credit");
    expect(firstCredit).toBeGreaterThan(0);
    const expected = steps
      .filter((s) => s.kind === "credit")
      .slice(0, 2)
      .map((s) => (s as { award: { photo: RevealedPhoto } }).award.photo.id);
    expect(upcomingPhotos(steps, firstCredit - 1).map((p) => p.id)).toEqual(expected);
  });
});

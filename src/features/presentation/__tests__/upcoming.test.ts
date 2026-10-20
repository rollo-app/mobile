import type { RevealedPhoto } from "@/features/media/revealed";
import { buildStory } from "../story";
import { sampleEvenly, upcomingPhotos } from "../upcoming";

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
  author: { id: "m1", name: "Cami" },
  thumbPath: "/t",
  originalPath: "/o",
});

describe("upcomingPhotos", () => {
  // 0 intro, 1 day, 2 a, 3 b, 4 day, 5 c, 6 outro
  const steps = buildStory(
    [photo("a", "2027-01-12T15:00:00Z"), photo("b", "2027-01-12T16:00:00Z"), photo("c", "2027-01-13T15:00:00Z")],
    "America/Argentina/Buenos_Aires",
  );

  it("returns the next two photos, crossing day cards", () => {
    expect(upcomingPhotos(steps, 2).map((p) => p.id)).toEqual(["b", "c"]);
  });

  it("returns what is left near the end and nothing after the last photo", () => {
    expect(upcomingPhotos(steps, 3).map((p) => p.id)).toEqual(["c"]);
    expect(upcomingPhotos(steps, 5)).toEqual([]);
  });

  it("from the intro it starts with the first photos", () => {
    expect(upcomingPhotos(steps, 0, 3).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});

describe("sampleEvenly", () => {
  it("keeps everything when it fits", () => {
    expect(sampleEvenly([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });

  it("spreads the picks over the whole list", () => {
    const picked = sampleEvenly(Array.from({ length: 200 }, (_, i) => i), 30);
    expect(picked).toHaveLength(30);
    expect(picked[0]).toBe(0);
    expect(picked.at(-1)).toBeGreaterThan(180);
  });
});

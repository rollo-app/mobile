import type { RevealedPhoto } from "@/features/media/revealed";
import { buildStory, daySegments, stepDuration } from "../story";

const TZ = "America/Argentina/Buenos_Aires";

let n = 0;
const photo = (iso: string, over: Partial<RevealedPhoto> = {}): RevealedPhoto => ({
  id: `p${++n}`,
  type: "photo",
  takenAt: Date.parse(iso),
  day: iso.slice(0, 10),
  lat: null,
  lng: null,
  caption: null,
  durationS: null,
  width: null,
  height: null,
  thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  author: { id: "m1", userId: "u-m1", name: "Cami", username: null, avatarUrl: null },
  thumbPath: "/t",
  originalPath: "/o",
  momentDay: null,
  selfie: null,
  authorUserId: "u-m1",
  featuredByMe: false,
  featureBlocked: false,
  likeCount: 0,
  canFeature: true,
  likedByMe: false,
  commentCount: 0,
  ...over,
});

describe("buildStory", () => {
  it("starts at the first day card (the reveal intro is its own screen) and ends with the outro", () => {
    const steps = buildStory([photo("2027-01-12T15:00:00Z")], TZ);
    expect(steps[0]!.kind).toBe("day");
    expect(steps.some((s) => (s.kind as string) === "intro")).toBe(false);
    expect(steps.at(-1)!.kind).toBe("outro");
  });

  it("is just the outro when there is nothing to show", () => {
    expect(buildStory([], TZ).map((s) => s.kind)).toEqual(["outro"]);
  });

  it("puts a day card before each day's photos, in chronological order", () => {
    const b = photo("2027-01-13T15:00:00Z");
    const a2 = photo("2027-01-12T18:00:00Z");
    const a1 = photo("2027-01-12T15:00:00Z");
    const steps = buildStory([b, a2, a1], TZ);
    expect(steps.map((s) => (s.kind === "photo" ? s.photo.id : s.kind))).toEqual([
      "day",
      a1.id,
      a2.id,
      "day",
      b.id,
      "outro",
    ]);
  });

  it("cuts days in the roll's time zone, not UTC", () => {
    // 01:30 UTC on the 13th is still 22:30 on the 12th in Buenos Aires.
    const late = photo("2027-01-13T01:30:00Z");
    const next = photo("2027-01-13T12:00:00Z");
    const steps = buildStory([late, next], TZ);
    expect(steps.filter((s) => s.kind === "day")).toHaveLength(2);
  });

  it("numbers the days counting from the first one, with a gap for empty days", () => {
    const steps = buildStory([photo("2027-01-12T15:00:00Z"), photo("2027-01-15T15:00:00Z")], TZ);
    const days = steps.flatMap((s) => (s.kind === "day" ? [s] : []));
    expect(days.map((d) => d.number)).toEqual([1, 4]);
    expect(days[0]!.day).toBe("2027-01-12");
    expect(days[0]!.title).toBe("Día 1");
    expect(days[0]!.date).toBe("12 de enero");
  });

  it("computes the stats and who took the most photos", () => {
    const steps = buildStory(
      [
        photo("2027-01-12T15:00:00Z", { author: { id: "m1", userId: "u-m1", name: "Cami", username: null, avatarUrl: null } }),
        photo("2027-01-12T16:00:00Z", { author: { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null } }),
        photo("2027-01-13T16:00:00Z", { author: { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null } }),
        photo("2027-01-13T17:00:00Z", { type: "video", durationS: 8, author: { id: "m1", userId: "u-m1", name: "Cami", username: null, avatarUrl: null } }),
      ],
      TZ,
    );
    const outro = steps.at(-1);
    expect(outro).toMatchObject({
      kind: "outro",
      stats: { photos: 3, videos: 1, people: 2, days: 2, top: { name: "Fede", count: 2 } },
    });
  });

  it("has no top photographer when only one person took photos", () => {
    const steps = buildStory([photo("2027-01-12T15:00:00Z"), photo("2027-01-12T16:00:00Z")], TZ);
    expect(steps.at(-1)).toMatchObject({ stats: { people: 1, top: null } });
  });

  it("breaks a tie for top photographer in favour of whoever shot first", () => {
    const steps = buildStory(
      [
        photo("2027-01-12T15:00:00Z", { author: { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null } }),
        photo("2027-01-12T16:00:00Z", { author: { id: "m1", userId: "u-m1", name: "Cami", username: null, avatarUrl: null } }),
      ],
      TZ,
    );
    expect(steps.at(-1)).toMatchObject({ stats: { top: { name: "Fede", count: 1 } } });
  });
});

describe("stepDuration", () => {
  it("gives photos 4 s, day cards 2 s and videos their own length up to 15 s", () => {
    const steps = buildStory(
      [photo("2027-01-12T15:00:00Z"), photo("2027-01-12T16:00:00Z", { type: "video", durationS: 6 })],
      TZ,
    );
    const [day, ph, vid] = steps;
    expect(stepDuration(day!)).toBe(2000);
    expect(stepDuration(ph!)).toBe(4000);
    expect(stepDuration(vid!)).toBe(6000);
    expect(stepDuration({ kind: "photo", photo: photo("2027-01-12T17:00:00Z", { type: "video", durationS: 40 }) })).toBe(15000);
    expect(stepDuration({ kind: "photo", photo: photo("2027-01-12T17:00:00Z", { type: "video" }) })).toBe(4000);
  });

  it("never advances by itself from the outro", () => {
    expect(stepDuration(buildStory([], TZ).at(-1)!)).toBeNull();
  });
});

describe("daySegments", () => {
  const steps = buildStory(
    [photo("2027-01-12T15:00:00Z"), photo("2027-01-12T16:00:00Z"), photo("2027-01-13T15:00:00Z")],
    TZ,
  );
  // 0 day, 1 p, 2 p, 3 day, 4 p, 5 outro

  it("counts the current day's photos and the position inside them", () => {
    expect(daySegments(steps, 2)).toEqual({ count: 2, current: 1 });
    expect(daySegments(steps, 4)).toEqual({ count: 1, current: 0 });
  });

  it("shows the day's bar empty while its card is on screen", () => {
    expect(daySegments(steps, 0)).toEqual({ count: 2, current: -1 });
    expect(daySegments(steps, 3)).toEqual({ count: 1, current: -1 });
  });

  it("has no segments in the outro", () => {
    expect(daySegments(steps, 5)).toBeNull();
  });
});

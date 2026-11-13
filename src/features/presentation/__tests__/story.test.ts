import type { RevealedPhoto } from "@/features/media/revealed";
import { MAX_STORY_PER_DAY, buildStory, daySegments, elapsedProgress, pickDayHighlights, stepDuration } from "../story";

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
  displayPath: "/o",
  originalAvailable: true,
  momentDay: null,
  archived: false,
  selfie: null,
  groupIds: [],
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

describe("elapsedProgress", () => {
  it("advances linearly from where the step was", () => {
    expect(elapsedProgress(0, 1000, 4000)).toBe(0.25);
    expect(elapsedProgress(0.5, 1000, 4000)).toBe(0.75);
  });
  it("never goes past the end or below the start", () => {
    expect(elapsedProgress(0.9, 4000, 4000)).toBe(1);
    expect(elapsedProgress(0.2, -50, 4000)).toBe(0.2 - 50 / 4000);
    expect(elapsedProgress(0, -10_000, 4000)).toBe(0);
  });
  it("treats an empty step as done", () => {
    expect(elapsedProgress(0, 0, 0)).toBe(1);
  });
});

const at = (second: number) => Date.parse("2027-01-12T12:00:00Z") + second * 1000;
const author = (id: string) => ({ id, userId: `u-${id}`, name: id, username: null, avatarUrl: null });
/** `n` photos one second apart on the same day, ids sortable. */
const dayOf = (n: number, over: (i: number) => Partial<RevealedPhoto> = () => ({})) =>
  Array.from({ length: n }, (_, i) =>
    photo("2027-01-12T12:00:00Z", { id: `x${String(i).padStart(4, "0")}`, takenAt: at(i), ...over(i) }),
  );

describe("pickDayHighlights", () => {
  it("caps a day at 30 stories", () => {
    expect(MAX_STORY_PER_DAY).toBe(30);
  });

  it("keeps every photo, in order, when the day fits", () => {
    const list = dayOf(30);
    expect(pickDayHighlights(list, 30)).toEqual(list);
    expect(pickDayHighlights([], 30)).toEqual([]);
  });

  it("returns exactly the cap for a huge day, in chronological order, without repeats", () => {
    const list = dayOf(2000);
    const out = pickDayHighlights([...list].reverse(), 30);
    expect(out).toHaveLength(30);
    expect(new Set(out.map((p) => p.id)).size).toBe(30);
    expect(out.map((p) => p.takenAt)).toEqual([...out.map((p) => p.takenAt)].sort((a, b) => a - b));
  });

  it("spreads the pick across the whole span of the day", () => {
    const list = dayOf(2000);
    const out = pickDayHighlights(list, 30);
    // one per bucket of ~66 photos: early, middle and late are all there
    expect(out[0]!.takenAt).toBeLessThan(at(67));
    expect(out.some((p) => p.takenAt > at(900) && p.takenAt < at(1100))).toBe(true);
    expect(out.at(-1)!.takenAt).toBeGreaterThanOrEqual(at(1933));
    out.forEach((p, i) => {
      expect(p.takenAt).toBeGreaterThanOrEqual(at(Math.floor((i * 2000) / 30)));
      expect(p.takenAt).toBeLessThan(at(Math.floor(((i + 1) * 2000) / 30)));
    });
  });

  it("prefers the most liked photo inside its bucket", () => {
    const list = dayOf(60, (i) => ({ likeCount: i === 1 ? 5 : i === 58 ? 9 : 0 }));
    const out = pickDayHighlights(list, 2);
    expect(out.map((p) => p.id)).toEqual(["x0001", "x0058"]);
  });

  it("breaks a likes tie with an author not picked yet, then earliest, then id", () => {
    // bucket 0 = [0..2]: only Cami's first photo is picked (earliest). Bucket 1 = [3..5]: all tied on likes,
    // Fede hasn't been picked yet so his later photo wins over Cami's earlier ones.
    const authors = ["m1", "m1", "m1", "m1", "m1", "m2"];
    const list = dayOf(6, (i) => ({ author: author(authors[i]!) }));
    expect(pickDayHighlights(list, 2).map((p) => p.id)).toEqual(["x0000", "x0005"]);

    const same = dayOf(6, () => ({}));
    expect(pickDayHighlights(same, 2).map((p) => p.id)).toEqual(["x0000", "x0003"]);

    const twins = [
      photo("2027-01-12T12:00:00Z", { id: "b", takenAt: at(0) }),
      photo("2027-01-12T12:00:00Z", { id: "a", takenAt: at(0) }),
    ];
    expect(pickDayHighlights(twins, 1).map((p) => p.id)).toEqual(["a"]);
  });

  it("is deterministic whatever the input order", () => {
    const list = dayOf(500, (i) => ({ likeCount: i % 7, author: author(`m${i % 5}`) }));
    const a = pickDayHighlights(list, 30).map((p) => p.id);
    const b = pickDayHighlights([...list].reverse(), 30).map((p) => p.id);
    expect(b).toEqual(a);
    expect(pickDayHighlights(list, 30).map((p) => p.id)).toEqual(a);
  });
});

describe("buildStory with a huge day", () => {
  const big = dayOf(2000, (i) => ({ author: author(i % 2 ? "m2" : "m1"), type: i % 10 === 0 ? "video" : "photo" }));

  it("has one day card and 30 photos for the day, with the real total on the card", () => {
    const steps = buildStory(big, TZ);
    expect(steps.map((s) => s.kind).filter((k) => k !== "photo")).toEqual(["day", "outro"]);
    expect(steps.filter((s) => s.kind === "photo")).toHaveLength(30);
    expect(steps[0]).toMatchObject({ kind: "day", count: 2000, shown: 30, trimmed: true });
  });

  it("leaves a day that fits untouched and untrimmed", () => {
    const steps = buildStory(dayOf(3), TZ);
    expect(steps[0]).toMatchObject({ kind: "day", count: 3, shown: 3, trimmed: false });
    expect(steps.at(-1)).toMatchObject({ stats: { trimmed: false } });
  });

  it("counts every photo and video in the stats, not just the selection", () => {
    const outro = buildStory(big, TZ).at(-1);
    expect(outro).toMatchObject({
      kind: "outro",
      stats: { photos: 1800, videos: 200, people: 2, days: 1, trimmed: true },
    });
  });

  it("marks the outro as trimmed when any day was cut", () => {
    const small = [photo("2027-01-13T15:00:00Z")];
    expect(buildStory([...big, ...small], TZ).at(-1)).toMatchObject({ stats: { trimmed: true, days: 2 } });
  });

  it("sizes the day's bar by the selection, on the card and on its photos", () => {
    const steps = buildStory(big, TZ);
    expect(daySegments(steps, 0)).toEqual({ count: 30, current: -1 });
    expect(daySegments(steps, 30)).toEqual({ count: 30, current: 29 });
  });
});

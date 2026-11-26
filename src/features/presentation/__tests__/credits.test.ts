import type { RevealedPhoto } from "@/features/media/revealed";
import { awardNames, computeCredits, type AwardKind } from "../credits";

const TZ = "America/Argentina/Buenos_Aires";

let n = 0;
const photo = (iso: string, over: Partial<RevealedPhoto> = {}): RevealedPhoto => ({
  shareable: false,
  id: `p${String(++n).padStart(4, "0")}`,
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

const by = (key: "m1" | "m2" | "m3" | "m4") => {
  const names = { m1: "Cami", m2: "Sofi", m3: "Juani", m4: "Lu" };
  return { author: { id: key, userId: `u-${key}`, name: names[key], username: null, avatarUrl: null }, authorUserId: `u-${key}` };
};

// Local noon in Buenos Aires (UTC-3): inside neither the first-light nor the night window.
const NOON = "2027-01-05T15:00:00Z";
/** `count` filler photos at local noon, alternating between Cami and Sofi, so the gates pass. */
const filler = (count: number, iso = NOON) =>
  Array.from({ length: count }, (_, i) => photo(iso, by(i % 2 === 0 ? "m1" : "m2")));
const award = (photos: RevealedPhoto[], kind: AwardKind, blocked: string[] = []) =>
  computeCredits(photos, TZ, new Set(blocked)).awards.find((a) => a.kind === kind);

describe("computeCredits gates", () => {
  it("gives no awards with 9 eligible photos but still lists the cast", () => {
    const c = computeCredits(filler(9), TZ, new Set());
    expect(c.awards).toEqual([]);
    expect(c.cast).toEqual(["Cami", "Sofi"]);
  });

  it("gives no awards when 10 photos are all by one author", () => {
    const photos = Array.from({ length: 10 }, () => photo(NOON));
    const c = computeCredits(photos, TZ, new Set());
    expect(c.awards).toEqual([]);
    expect(c.cast).toEqual(["Cami"]);
  });
});

describe("firstLight / nightShift", () => {
  it("firstLight picks the earliest time in 05:00-09:00 with its detail and photo", () => {
    const early = photo("2027-01-05T09:42:00Z", by("m2")); // 06:42 local
    const late = photo("2027-01-05T10:10:00Z"); // 07:10 local
    const first = photo("2027-01-03T15:00:00Z"); // two local days earlier
    const a = award([...filler(8), early, late, first], "firstLight")!;
    expect(a.title).toBe("Primera luz");
    expect(a.names).toEqual(["Sofi"]);
    expect(a.detail).toBe("06:42 · Día 3");
    expect(a.photo).toBe(early);
  });

  it("respects the window edges", () => {
    const at5 = photo("2027-01-05T08:00:00Z"); // 05:00:00
    const at0459 = photo("2027-01-05T07:59:00Z"); // 04:59:00
    expect(award([...filler(9), at5], "firstLight")!.photo).toBe(at5);
    expect(award([...filler(9), at0459], "nightShift")!.photo).toBe(at0459);
    expect(award([...filler(9), at0459], "firstLight")).toBeUndefined();
    const at9 = photo("2027-01-05T12:00:00Z"); // 09:00:00
    const at2359 = photo("2027-01-06T02:59:00Z"); // 23:59 on Jan 5
    const none = computeCredits([...filler(8), at9, at2359], TZ, new Set());
    expect(none.awards.find((a) => a.kind === "firstLight")).toBeUndefined();
    expect(none.awards.find((a) => a.kind === "nightShift")).toBeUndefined();
  });

  it("counts midnight as night and loses to 03:17", () => {
    const midnight = photo("2027-01-05T03:00:00Z"); // 00:00 local
    const three = photo("2027-01-05T06:17:00Z", by("m2")); // 03:17 local
    expect(award([...filler(9), midnight], "nightShift")!.photo).toBe(midnight);
    expect(award([...filler(8), midnight, three], "nightShift")!.photo).toBe(three);
  });

  it("nightShift picks 03:17 over 01:00 with its detail", () => {
    const one = photo("2027-01-05T04:00:00Z");
    const three = photo("2027-01-05T06:17:00Z", by("m2"));
    const a = award([...filler(8), one, three], "nightShift")!;
    expect(a.title).toBe("Turno noche");
    expect(a.photo).toBe(three);
    expect(a.detail).toBe("03:17 · Día 1");
  });

  it("breaks an exact-time tie with the smaller id", () => {
    const b = photo("2027-01-05T09:00:00Z", { id: "b" });
    const a = photo("2027-01-06T09:00:00Z", { id: "a" });
    expect(award([...filler(8), b, a], "firstLight")!.photo).toBe(a);
  });
});

describe("script", () => {
  const captioned = (text: string | null, key: "m1" | "m2" = "m1") => photo(NOON, { caption: text, ...by(key) });

  it("wins with 3 captions, and the background is the longest one", () => {
    const long = captioned("a much longer caption");
    const a = award([...filler(8), captioned("hi"), long, captioned("hello")], "script")!;
    expect(a.title).toBe("Guion");
    expect(a.detail).toBe("3 textos");
    expect(a.names).toEqual(["Cami"]);
    expect(a.photo).toBe(long);
  });

  it("gives no award with 2 captions", () => {
    expect(award([...filler(8), captioned("one"), captioned("two")], "script")).toBeUndefined();
  });

  it("does not count blank or whitespace-only captions", () => {
    const photos = [...filler(8), captioned("one"), captioned("two"), captioned("   "), captioned(""), captioned("\n ")];
    expect(award(photos, "script")).toBeUndefined();
  });
});

describe("locations", () => {
  const at = (lat: number | null, lng: number | null) => photo(NOON, { lat, lng });

  it("wins with 3 distinct cells; the background is the photo that reached the last new one", () => {
    const photos = [...filler(8), at(-34.6, -58.4), at(-34.6, -58.4), at(-34.7, -58.4), at(-34.8, -58.3)];
    const third = photos.at(-1)!;
    const a = award(photos, "locations")!;
    expect(a.title).toBe("Locaciones");
    expect(a.detail).toBe("3 lugares");
    expect(a.photo).toBe(third);
  });

  it("ignores photos without coordinates", () => {
    const photos = [...filler(8), at(-34.6, -58.4), at(-34.7, -58.4), at(null, null), at(-34.8, null), at(null, -58.1)];
    expect(award(photos, "locations")).toBeUndefined();
  });

  it("counts two photos in the same 0.01 degree cell once", () => {
    const photos = [...filler(8), at(-34.601, -58.401), at(-34.604, -58.404), at(-34.7, -58.4)];
    expect(award(photos, "locations")).toBeUndefined();
  });
});

describe("camera", () => {
  it("gives no award when the top count is below 5", () => {
    expect(award(filler(8), "camera")).toBeUndefined();
  });

  it("wins with 5+ photos; the background is the most liked, earliest on a tie", () => {
    const liked = photo(NOON, { likeCount: 4 });
    const tied = photo(NOON, { likeCount: 4 });
    const photos = [liked, tied, photo(NOON), photo(NOON), photo(NOON), photo(NOON, by("m2")), photo(NOON, by("m2"))];
    const a = award([...photos, ...filler(3)], "camera")!;
    expect(a.title).toBe("Cámara");
    expect(a.names).toEqual(["Cami"]);
    expect(a.detail).toBe("7 fotos");
    expect(a.photo).toBe(liked);
  });
});

describe("ties", () => {
  it("shares a two-way tie, ordered by each one's first photo", () => {
    const a = award(
      [
        ...Array.from({ length: 5 }, () => photo(NOON, by("m2"))),
        ...Array.from({ length: 5 }, () => photo("2027-01-05T16:00:00Z", by("m1"))),
      ],
      "camera",
    )!;
    expect(a.names).toEqual(["Sofi", "Cami"]);
    expect(a.detail).toBe("5 fotos");
  });

  it("omits the award on a three-way tie", () => {
    const photos = (["m1", "m2", "m3"] as const).flatMap((k) => Array.from({ length: 5 }, () => photo(NOON, by(k))));
    expect(award(photos, "camera")).toBeUndefined();
  });
});

describe("eligibility", () => {
  it("ignores archived photos and videos for awards; a video author is in the cast", () => {
    const archived = photo("2027-01-05T09:42:00Z", { archived: true });
    const video = photo("2027-01-05T09:43:00Z", { type: "video", ...by("m3") });
    const c = computeCredits([...filler(10), archived, video], TZ, new Set());
    expect(c.awards.find((a) => a.kind === "firstLight")).toBeUndefined();
    // The video is at 06:43, before the noon photos, so Juani comes first.
    expect(c.cast).toEqual(["Juani", "Cami", "Sofi"]);
  });

  it("a video alone does not count toward the photo gate", () => {
    const c = computeCredits([...filler(9), photo(NOON, { type: "video" })], TZ, new Set());
    expect(c.awards).toEqual([]);
  });

  it("a blocked author wins nothing, is not in the cast, and the gate is re-evaluated", () => {
    const blocked = Array.from({ length: 12 }, () => photo("2027-01-05T09:42:00Z", by("m3")));
    const rest = filler(10);
    const full = computeCredits([...blocked, ...rest], TZ, new Set(["u-m3"]));
    expect(full.cast).toEqual(["Cami", "Sofi"]);
    expect(full.awards.some((a) => a.names.includes("Juani"))).toBe(false);
    expect(full.awards.find((a) => a.kind === "firstLight")).toBeUndefined();

    const gated = computeCredits([...blocked, ...filler(9)], TZ, new Set(["u-m3"]));
    expect(gated.awards).toEqual([]);
    expect(gated.cast).toEqual(["Cami", "Sofi"]);
  });
});

describe("awardNames", () => {
  it("joins one and two names", () => {
    expect(awardNames(["Juani"])).toBe("Juani");
    expect(awardNames(["Juani", "Sofi"])).toBe("Juani y Sofi");
  });
});

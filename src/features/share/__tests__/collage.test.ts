import type { RevealedPhoto } from "@/features/media/revealed";
import {
  COLLAGE_MAX,
  canShuffle,
  collageCandidates,
  collageCaption,
  collageLayout,
  dateRange,
  nextSeed,
  pickCollage,
  type Rect,
} from "../collage";

function photo(id: string, shareable = true): RevealedPhoto {
  return { id, shareable } as RevealedPhoto;
}

const photos = (n: number) =>
  Array.from({ length: n }, (_, i) => photo(`p${i}`));
const ids = (list: RevealedPhoto[]) => list.map((p) => p.id);

describe("collageCandidates", () => {
  it("keeps only shareable photos", () => {
    const all = [photo("a"), photo("b", false), photo("c")];
    expect(ids(collageCandidates(all))).toEqual(["a", "c"]);
  });
});

describe("pickCollage", () => {
  it("returns COLLAGE_MAX photos without repeats from many candidates", () => {
    const picked = pickCollage(photos(20), 1);
    expect(picked).toHaveLength(COLLAGE_MAX);
    expect(new Set(ids(picked)).size).toBe(COLLAGE_MAX);
  });

  it("is deterministic for a seed", () => {
    expect(ids(pickCollage(photos(20), 7))).toEqual(
      ids(pickCollage(photos(20), 7)),
    );
  });

  it("gives a different order or hero for different seeds", () => {
    expect(ids(pickCollage(photos(20), 1))).not.toEqual(
      ids(pickCollage(photos(20), 2)),
    );
  });

  it("returns every candidate when there are fewer than the max", () => {
    const picked = pickCollage(photos(3), 5);
    expect(picked).toHaveLength(3);
    expect(new Set(ids(picked))).toEqual(new Set(["p0", "p1", "p2"]));
  });

  it("does not mutate the input", () => {
    const input = photos(10);
    pickCollage(input, 3);
    expect(ids(input)).toEqual(ids(photos(10)));
  });
});

describe("canShuffle", () => {
  it("needs at least two candidates", () => {
    expect(canShuffle(photos(1))).toBe(false);
    expect(canShuffle(photos(2))).toBe(true);
  });
});

describe("collageLayout", () => {
  const frame: Rect = { x: 0, y: 0, w: 1000, h: 1200 };
  const gap = 12;
  const area = (r: Rect) => r.w * r.h;
  const overlap = (a: Rect, b: Rect) =>
    a.x < b.x + b.w - 1e-6 &&
    b.x < a.x + a.w - 1e-6 &&
    a.y < b.y + b.h - 1e-6 &&
    b.y < a.y + a.h - 1e-6;

  for (let count = 1; count <= COLLAGE_MAX; count++) {
    describe(`with ${count} photos`, () => {
      const rects = collageLayout(count, frame, gap) as [Rect, ...Rect[]];

      it("returns one rect per photo inside the frame", () => {
        expect(rects).toHaveLength(count);
        for (const r of rects) {
          expect(r.x).toBeGreaterThanOrEqual(frame.x - 1e-6);
          expect(r.y).toBeGreaterThanOrEqual(frame.y - 1e-6);
          expect(r.x + r.w).toBeLessThanOrEqual(frame.x + frame.w + 1e-6);
          expect(r.y + r.h).toBeLessThanOrEqual(frame.y + frame.h + 1e-6);
        }
      });

      it("has no overlaps", () => {
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(overlap(rects[i] as Rect, rects[j] as Rect)).toBe(false);
          }
        }
      });

      it("makes the hero the largest", () => {
        for (const r of rects.slice(1))
          expect(area(rects[0])).toBeGreaterThanOrEqual(area(r));
      });

      it("leaves no holes", () => {
        const sum = rects.reduce((s, r) => s + (r.w + gap) * (r.h + gap), 0);
        expect(
          Math.abs(sum - (frame.w + gap) * (frame.h + gap)),
        ).toBeLessThanOrEqual(count);
      });
    });
  }

  it("reproduces option B for 8 photos: 6x4 grid, hero 4x2 top left", () => {
    const rects = collageLayout(8, frame, gap) as [Rect, ...Rect[]];
    const cellW = (frame.w - gap * 5) / 6;
    const cellH = (frame.h - gap * 3) / 4;
    const [hero, ...rest] = rects;
    expect(hero.x).toBeCloseTo(0);
    expect(hero.y).toBeCloseTo(0);
    expect(hero.w).toBeCloseTo(4 * cellW + 3 * gap);
    expect(hero.h).toBeCloseTo(2 * cellH + gap);
    expect(rest).toHaveLength(7);
    for (const r of rest) expect(r.w).toBeCloseTo(2 * cellW + gap);
  });

  it("offsets rects by the frame origin", () => {
    const rects = collageLayout(1, { x: 50, y: 80, w: 400, h: 600 }, 10);
    expect(rects[0]).toEqual({ x: 50, y: 80, w: 400, h: 600 });
  });
});

describe("dateRange", () => {
  const day = (iso: string) => Date.parse(iso);
  const tz = "America/Argentina/Buenos_Aires";

  it("collapses the month within the same month", () => {
    expect(
      dateRange(day("2026-01-03T15:00:00Z"), day("2026-01-09T15:00:00Z"), tz),
    ).toBe("3 – 9 de enero");
  });

  it("names both months across two months", () => {
    expect(
      dateRange(day("2025-12-28T15:00:00Z"), day("2026-01-03T15:00:00Z"), tz),
    ).toBe("28 de diciembre – 3 de enero");
  });

  it("shows a single day once", () => {
    expect(
      dateRange(day("2026-12-12T15:00:00Z"), day("2026-12-12T20:00:00Z"), tz),
    ).toBe("12 de diciembre");
  });

  it("does not depend on formatToParts (Hermes returns no month part)", () => {
    const spy = jest
      .spyOn(Intl.DateTimeFormat.prototype, "formatToParts")
      .mockReturnValue([{ type: "day", value: "23" }]);
    try {
      expect(
        dateRange(day("2026-01-23T15:00:00Z"), day("2026-01-30T15:00:00Z"), tz),
      ).toBe("23 – 30 de enero");
    } finally {
      spy.mockRestore();
    }
  });

  it("uses the trip's time zone", () => {
    // 02:00 UTC on the 10th is still the 9th in Buenos Aires.
    expect(
      dateRange(day("2026-01-03T15:00:00Z"), day("2026-01-10T02:00:00Z"), tz),
    ).toBe("3 – 9 de enero");
  });
});

describe("collageCaption", () => {
  const tz = "America/Argentina/Buenos_Aires";
  const startsAt = Date.parse("2026-01-03T15:00:00Z");
  const endsAt = Date.parse("2026-01-09T15:00:00Z");

  it("joins the dates and the people", () => {
    expect(collageCaption({ startsAt, endsAt, timeZone: tz, people: 8 })).toBe(
      "3 – 9 de enero · 8 personas",
    );
  });

  it("uses the singular for one person", () => {
    expect(collageCaption({ startsAt, endsAt, timeZone: tz, people: 1 })).toBe(
      "3 – 9 de enero · 1 persona",
    );
  });
});

describe("nextSeed", () => {
  it("moves to a seed that puts a different photo first, whatever the pool", () => {
    const two = [photo("a"), photo("b")];
    for (let seed = 0; seed < 30; seed++) {
      expect(pickCollage(two, nextSeed(two, seed))[0]?.id).not.toBe(pickCollage(two, seed)[0]?.id);
    }
  });
});

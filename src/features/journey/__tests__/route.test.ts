import { buildStops, buildTimeline, cellCenter, FILM_CUTS, filmMs, travelZoom, type FilmPhoto, type Stop } from "../route";

const START = Date.UTC(2026, 6, 1);
const FRAME_W = 432;

function photo(id: string, lat: number, lng: number, minutes: number, over: Partial<FilmPhoto> = {}): FilmPhoto {
  const takenAt = START + minutes * 60_000;
  return {
    id,
    authorId: "a",
    authorName: "A",
    authorAvatar: null,
    lat,
    lng,
    takenAt,
    day: new Date(takenAt).toISOString().slice(0, 10),
    likeCount: 0,
    thumb: { uri: `thumb:${id}` },
    display: { uri: `display:${id}` },
    ...over,
  };
}

/** `n` photos within a few metres of a point. */
function group(prefix: string, lat: number, lng: number, n: number, firstMinute: number): FilmPhoto[] {
  return Array.from({ length: n }, (_, i) => photo(`${prefix}${i}`, lat + i * 0.0001, lng, firstMinute + i));
}

const cellKey = (s: { lat: number; lng: number }) => `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`;

describe("cellCenter", () => {
  it("returns the centre of the 0.05 degree cell", () => {
    const c = cellCenter({ lat: -41.137, lng: -71.303 });
    expect(c.lat).toBeCloseTo(-41.125, 6);
    expect(c.lng).toBeCloseTo(-71.325, 6);
  });
});

describe("buildStops", () => {
  it("share cut: three photos within 800 m and one 60 km away give 2 stops, each at a cell centre", () => {
    const photos = [
      photo("a", -41.13, -71.3, 0),
      photo("b", -41.1325, -71.3, 5),
      photo("c", -41.1275, -71.3, 10),
      photo("d", -40.59, -71.3, 600),
    ];
    const stops = buildStops(photos, FILM_CUTS.share, "2026-07-01");
    expect(stops).toHaveLength(2);
    for (const s of stops) {
      const c = cellCenter(s);
      expect(s.lat).toBeCloseTo(c.lat, 6);
      expect(s.lng).toBeCloseTo(c.lng, 6);
    }
    expect(stops[0]!.photos).toHaveLength(3);
  });

  it("share cut: two groups 3 km apart that fall in the same cell give 1 stop", () => {
    const photos = [...group("a", -41.13, -71.3, 3, 0), ...group("b", -41.103, -71.3, 3, 600)];
    expect(buildStops(photos, FILM_CUTS.share, "2026-07-01")).toHaveLength(1);
  });

  it("share cut: two groups 1.5 km apart in different cells still give 1 stop", () => {
    const photos = [...group("a", -41.1075, -71.3, 3, 0), ...group("b", -41.094, -71.3, 3, 600)];
    expect(cellCenter({ lat: -41.1075, lng: -71.3 }).lat).not.toBe(cellCenter({ lat: -41.094, lng: -71.3 }).lat);
    const stops = buildStops(photos, FILM_CUTS.share, "2026-07-01");
    expect(stops).toHaveLength(1);
    expect(stops[0]!.photos).toHaveLength(6);
  });

  it("reveal cut: the same two groups 3 km apart give 2 stops at exact coordinates", () => {
    const photos = [
      ...Array.from({ length: 3 }, (_, i) => photo(`a${i}`, -41.13, -71.3, i)),
      ...Array.from({ length: 3 }, (_, i) => photo(`b${i}`, -41.103, -71.3, 600 + i)),
    ];
    const stops = buildStops(photos, FILM_CUTS.reveal, "2026-07-01");
    expect(stops).toHaveLength(2);
    expect(stops[0]!.lat).toBeCloseTo(-41.13, 6);
    expect(stops[0]!.lng).toBeCloseTo(-71.3, 6);
    expect(stops[1]!.lat).toBeCloseTo(-41.103, 6);
    expect(stops[1]!.lng).toBeCloseTo(-71.3, 6);
  });

  it("shows the most liked photos of a stop, in time order", () => {
    const likes = [0, 5, 2, 9];
    const photos = likes.map((likeCount, i) => photo(`p${i}`, -41.13, -71.3, i, { likeCount }));
    const stops = buildStops(photos, { ...FILM_CUTS.share, maxPerStop: 2 }, "2026-07-01");
    expect(stops).toHaveLength(1);
    expect(stops[0]!.shots.map((p) => p.likeCount)).toEqual([5, 9]);
    expect(stops[0]!.shots.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("spreads the ties over the time at the stop", () => {
    const photos = Array.from({ length: 6 }, (_, i) => photo(`p${i}`, -41.13, -71.3, i));
    const stops = buildStops(photos, { ...FILM_CUTS.share, maxPerStop: 2 }, "2026-07-01");
    expect(stops[0]!.shots.map((p) => p.id)).toEqual(["p1", "p4"]);
  });

  it("counts days from the given first day, not from the first photo", () => {
    const photos = [photo("a", -41.13, -71.3, 0), photo("b", -41.13, -71.3, 1)];
    const stops = buildStops(photos, FILM_CUTS.share, "2026-06-29");
    expect(stops[0]!.dayNumber).toBe(3);
    expect(stops[0]!.lastDayNumber).toBe(3);
    expect(stops[0]!.shotDays[0]).toBe(3);
  });

  it("shares the photo budget after merging stops that fall in the same cell", () => {
    // Two visits to the same cell, with a far place between them: three route stops become two... and the one
    // that merged shows the photos of both.
    const photos = [
      ...group("a", -41.13, -71.3, 2, 0),
      ...group("b", -41.103, -71.3, 2, 600),
      ...group("c", -40.0, -71.3, 1, 1200),
    ];
    const stops = buildStops(photos, FILM_CUTS.share, "2026-07-01");
    expect(stops).toHaveLength(2);
    expect(stops[0]!.photos).toHaveLength(4);
    expect(stops[0]!.shots).toHaveLength(4);
    expect(stops[1]!.shots).toHaveLength(1);
  });

  it("share cut: consecutive stops never share a cell after merging, even when the merged median moves", () => {
    // X, then two visits whose medians are in cell Y (the second one spread over both sides), then X again.
    const photos = [
      ...group("a", -41.13, -71.3, 2, 0),
      ...[-41.14, -41.099, -41.08].map((lat, i) => photo(`b${i}`, lat, -71.3, 600 + i)),
      ...[-41.11, -41.09, -41.07, -41.06].map((lat, i) => photo(`c${i}`, lat, -71.3, 700 + i)),
      ...group("d", -40.0, -71.3, 2, 1200),
      ...group("e", -41.13, -71.3, 2, 1800),
    ];
    const stops = buildStops(photos, FILM_CUTS.share, "2026-07-01");
    stops.forEach((s, i) => {
      if (i > 0) expect(cellKey(s)).not.toBe(cellKey(stops[i - 1]!));
    });
  });

  // The prototype's throwaway check data is not in the repo any more: this is the same situation rebuilt. Four people
  // start together, split on day 2 (two go to B, two to C, their photos alternating in time) and meet again at D.
  it.each([
    ["share", FILM_CUTS.share],
    ["reveal", FILM_CUTS.reveal],
  ] as const)("%s cut: four people with one split day give 6 stops", (_name, cut) => {
    const A = [-41.13, -71.3] as const;
    const B = [-40.8, -71.0] as const;
    const C = [-41.5, -71.7] as const;
    const D = [-41.1, -71.6] as const;
    const E = [-40.5, -71.5] as const;
    const F = [-40.1, -71.1] as const;
    const people = ["p1", "p2", "p3", "p4"];
    const photos: FilmPhoto[] = [];
    let n = 0;
    const add = (who: string, at: readonly [number, number], minutes: number) => {
      photos.push(photo(`s${n++}`, at[0] + n * 0.0002, at[1], minutes, { authorId: who }));
    };
    // Day 1: everybody at A.
    people.forEach((who, i) => add(who, A, i * 3));
    // Day 2 (split): p1 and p2 at B, p3 and p4 at C, interleaved.
    const day2 = 24 * 60;
    add("p1", B, day2);
    add("p2", B, day2 + 1);
    add("p3", C, day2 + 2);
    add("p4", C, day2 + 3);
    add("p1", B, day2 + 10);
    add("p3", C, day2 + 11);
    add("p2", B, day2 + 12);
    add("p4", C, day2 + 13);
    add("p1", B, day2 + 20);
    add("p4", C, day2 + 21);
    // Days 3 to 5: everybody together at D, E and F.
    [D, E, F].forEach((at, d) => people.forEach((who, i) => add(who, at, (2 + d) * 24 * 60 + i * 3)));
    const stops = buildStops(photos, cut, "2026-07-01");
    expect(stops).toHaveLength(6);
    expect(stops.map((s) => s.dayNumber)).toEqual([1, 2, 2, 3, 4, 5]);
  });
});

describe("travelZoom", () => {
  const stopAt = (lat: number): Stop => {
    const p = photo(`s${lat}`, lat, -71.3, 0);
    return { index: 0, lat, lng: -71.3, photos: [p], shots: [p], shotDays: [1], dayNumber: 1, lastDayNumber: 1 };
  };
  const apart = [stopAt(-41.13), stopAt(-41.13 + 2 / 111.2)];

  it("stops 2 km apart zoom to 10 in the share cut and past 10 in the reveal cut", () => {
    expect(travelZoom(apart, FRAME_W, FILM_CUTS.share)).toBe(10);
    expect(travelZoom(apart, FRAME_W, FILM_CUTS.reveal)).toBeGreaterThan(10);
  });

  it("never goes under 3", () => {
    expect(travelZoom([stopAt(-60), stopAt(60)], FRAME_W, FILM_CUTS.reveal)).toBe(3);
  });
});

describe("FILM_CUTS", () => {
  it("defines the share cut", () => {
    const c = FILM_CUTS.share;
    expect(c).toMatchObject({ maxPhotos: 15, maxStops: 15, maxPerStop: 4, endCardMs: 2500, redLight: false, snapToCell: true, minPlaceKm: 2.5, maxZoom: 10, cityTitles: true });
  });

  it("defines the reveal cut", () => {
    const c = FILM_CUTS.reveal;
    expect(c).toMatchObject({ endCardMs: 0, redLight: true, snapToCell: false, minPlaceKm: 0.5, maxZoom: 13, maxStops: 10 });
  });
});

describe("random trips", () => {
  it.each([
    ["share", FILM_CUTS.share],
    ["reveal", FILM_CUTS.reveal],
  ] as const)("%s cut: 300 seeded trips stay under 59 s with ordered timelines", (name, cut) => {
    let seed = 12345;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    let checked = 0;
    const exact = new Set<string>();
    for (let trial = 0; trial < 300; trial++) {
      const places = 2 + Math.floor(rnd() * 18);
      const spread = 0.5 + rnd() * 25;
      const photos: FilmPhoto[] = [];
      let ts = Date.UTC(2026, 5, 1);
      const count = 30 + Math.floor(rnd() * 120);
      for (let k = 0; k < count; k++) {
        const pl = Math.floor((k * places) / 60) % places;
        ts += Math.floor(rnd() * 3_600_000);
        photos.push({
          id: `p${k}`,
          authorId: "a" + Math.floor(rnd() * 3),
          authorName: "A",
          authorAvatar: null,
          lat: 40 + (pl * spread) / places + rnd() * 0.01,
          lng: 10 + (((pl * 7) % places) * spread) / places + rnd() * 0.01,
          takenAt: ts,
          day: new Date(ts).toISOString().slice(0, 10),
          likeCount: Math.floor(rnd() * 5),
          thumb: { uri: "" },
          display: { uri: "" },
        });
      }
      photos.forEach((p) => exact.add(`${p.lat},${p.lng}`));
      const stops = buildStops(photos, cut, "2026-06-01");
      if (name === "share") stops.forEach((s) => expect(exact.has(`${s.lat},${s.lng}`)).toBe(false));
      if (stops.length < 2) continue;
      checked++;
      const tl = buildTimeline(stops, travelZoom(stops, FRAME_W, cut), FRAME_W, cut);
      expect(filmMs(tl, cut)).toBeLessThanOrEqual(59_000);
      stops.forEach((_, i) => {
        expect(tl.arrive[i]!).toBeLessThan(tl.leave[i]!);
        expect(tl.leave[i]!).toBeLessThanOrEqual(tl.depart[i]!);
        if (name === "share" && i > 0) expect(cellKey(stops[i]!)).not.toBe(cellKey(stops[i - 1]!));
      });
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("filmMs adds the end card to doneAt", () => {
    const tl = { arrive: [], leave: [], depart: [], move: [], swaps: [], overviewAt: 0, hitAt: 0, titleAt: 0, doneAt: 10_000 };
    expect(filmMs(tl, FILM_CUTS.share)).toBe(12_500);
    expect(filmMs(tl, FILM_CUTS.reveal)).toBe(10_000);
  });
});

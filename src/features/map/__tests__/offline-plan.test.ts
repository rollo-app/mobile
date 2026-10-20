import {
  distanceKm,
  groupPlaces,
  inDownloadWindow,
  networkAllows,
  packExpiresAt,
  packInfoFromMetadata,
  packName,
  parsePackName,
  planDownloads,
  selectExpired,
  type PackInfo,
} from "../offline-plan";

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2027, 0, 10);
const END = Date.UTC(2027, 0, 20);
const trip = { tripId: "t1", startsAt: START, endsAt: END, revealed: false };

const CHALTEN: [number, number] = [-72.89, -49.33];
const CALAFATE: [number, number] = [-72.28, -50.34];
const BUENOS_AIRES: [number, number] = [-58.38, -34.6];

const pack = (over: Partial<PackInfo> = {}): PackInfo => ({
  id: "p1",
  tripId: "t1",
  kind: "detail",
  center: CHALTEN,
  radiusKm: 40,
  expiresAt: END + 7 * DAY,
  bytes: 10_000_000,
  ...over,
});

describe("inDownloadWindow", () => {
  it("opens 3 days before the start", () => {
    expect(inDownloadWindow(trip, START - 3 * DAY - 1)).toBe(false);
    expect(inDownloadWindow(trip, START - 3 * DAY)).toBe(true);
  });

  it("stays open until the end of the roll", () => {
    expect(inDownloadWindow(trip, END - 1)).toBe(true);
    expect(inDownloadWindow(trip, END)).toBe(false);
  });

  it("is closed once the roll is revealed", () => {
    expect(inDownloadWindow({ ...trip, revealed: true }, START + DAY)).toBe(false);
  });
});

describe("packExpiresAt", () => {
  it("is 7 days after the end of the roll", () => {
    expect(packExpiresAt(END)).toBe(END + 7 * DAY);
  });
});

describe("distanceKm", () => {
  it("is 0 for the same point and ~111 km per degree of latitude", () => {
    expect(distanceKm(CHALTEN, CHALTEN)).toBe(0);
    expect(distanceKm([0, 0], [0, 1])).toBeCloseTo(111.2, 0);
  });
});

describe("pack names", () => {
  it("round-trips trip, kind and rounded center", () => {
    const name = packName("t1", "detail", [-72.8912345, -49.3312345]);
    expect(name).toBe("rollo:t1:detail:-49.33,-72.89");
    expect(parsePackName(name)).toEqual({ tripId: "t1", kind: "detail", center: [-72.89, -49.33] });
  });

  it("returns null for names that are not ours", () => {
    expect(parsePackName("something-else")).toBeNull();
  });
});

describe("packInfoFromMetadata", () => {
  it("reads a pack saved by the sync", () => {
    const metadata = { name: "rollo:t1:wide:-49.33,-72.89", center: CHALTEN, radiusKm: 300, expiresAt: 5 };
    expect(packInfoFromMetadata("p9", metadata, 123)).toEqual({
      id: "p9",
      tripId: "t1",
      kind: "wide",
      center: CHALTEN,
      radiusKm: 300,
      expiresAt: 5,
      bytes: 123,
    });
  });

  it("ignores packs without our metadata", () => {
    expect(packInfoFromMetadata("p9", { center: CHALTEN }, 0)).toBeNull();
    expect(packInfoFromMetadata("p9", {}, 0)).toBeNull();
  });
});

describe("groupPlaces", () => {
  it("collapses 100 photos in the same town into one place", () => {
    const photos = Array.from({ length: 100 }, (_, i) => ({
      lat: -49.33 + (i % 10) * 0.001,
      lng: -72.89 + Math.floor(i / 10) * 0.001,
      takenAt: i,
    }));
    const places = groupPlaces(photos);
    expect(places).toHaveLength(1);
    expect(places[0]!.takenAt).toBe(99);
    expect(distanceKm(places[0]!.center, CHALTEN)).toBeLessThan(2);
  });

  it("keeps far away photos as separate places", () => {
    const places = groupPlaces([
      { lat: CHALTEN[1], lng: CHALTEN[0], takenAt: 1 },
      { lat: CALAFATE[1], lng: CALAFATE[0], takenAt: 2 },
    ]);
    expect(places).toHaveLength(2);
  });

  it("is empty without photos", () => {
    expect(groupPlaces([])).toEqual([]);
  });
});

describe("planDownloads", () => {
  const base = { trips: [{ trip, photos: [] }], existing: [], location: CHALTEN, capBytes: 400_000_000 };

  it("plans a wide and a detailed zone around the current location", () => {
    const zones = planDownloads(base);
    expect(zones.map((z) => [z.kind, z.radiusKm, z.minZoom, z.maxZoom])).toEqual([
      ["wide", 300, 5, 10],
      ["detail", 40, 10, 14],
    ]);
    expect(zones[0]!.name).toBe("rollo:t1:wide:-49.33,-72.89");
    expect(zones[0]!.expiresAt).toBe(END + 7 * DAY);
  });

  it("adds a detailed zone per place where the group took photos", () => {
    const photos = [
      { lat: CALAFATE[1], lng: CALAFATE[0], takenAt: 5 },
      { lat: CALAFATE[1] + 0.01, lng: CALAFATE[0], takenAt: 6 },
    ];
    const zones = planDownloads({ ...base, trips: [{ trip, photos }] });
    const detail = zones.filter((z) => z.kind === "detail");
    expect(detail).toHaveLength(2);
    expect(distanceKm(detail[1]!.center, CALAFATE)).toBeLessThan(2);
  });

  it("works without a location, using only the photo places", () => {
    const photos = [{ lat: CALAFATE[1], lng: CALAFATE[0], takenAt: 5 }];
    const zones = planDownloads({ ...base, location: null, trips: [{ trip, photos }] });
    expect(zones.map((z) => z.kind)).toEqual(["detail"]);
  });

  it("skips zones already covered by a downloaded pack of the same trip and kind", () => {
    const nearby: [number, number] = [CHALTEN[0] + 0.05, CHALTEN[1] + 0.05];
    const zones = planDownloads({ ...base, location: nearby, existing: [pack()] });
    expect(zones.map((z) => z.kind)).toEqual(["wide"]);
  });

  it("downloads again when the person moved out of the covered area", () => {
    const zones = planDownloads({ ...base, location: CALAFATE, existing: [pack()] });
    expect(zones.map((z) => z.kind)).toContain("detail");
  });

  it("does not treat a pack of another trip or kind as coverage", () => {
    expect(planDownloads({ ...base, existing: [pack({ tripId: "other" })] }).map((z) => z.kind)).toContain("detail");
    expect(planDownloads({ ...base, existing: [pack({ kind: "wide", radiusKm: 300 })] }).map((z) => z.kind)).toContain("detail");
  });

  it("does not plan two zones for nearby places", () => {
    const photos = [{ lat: CHALTEN[1] + 0.02, lng: CHALTEN[0], takenAt: 1 }];
    const zones = planDownloads({ ...base, trips: [{ trip, photos }] });
    expect(zones.filter((z) => z.kind === "detail")).toHaveLength(1);
  });

  it("stays under the total cap, keeping the zones closest to the person", () => {
    const photos = [
      { lat: CALAFATE[1], lng: CALAFATE[0], takenAt: 9 },
      { lat: BUENOS_AIRES[1], lng: BUENOS_AIRES[0], takenAt: 99 },
    ];
    const all = planDownloads({ ...base, trips: [{ trip, photos }] });
    const total = all.reduce((sum, z) => sum + z.estimatedBytes, 0);
    const zones = planDownloads({ ...base, trips: [{ trip, photos }], capBytes: total - 1 });
    expect(zones).toHaveLength(all.length - 1);
    expect(zones.some((z) => distanceKm(z.center, BUENOS_AIRES) < 5)).toBe(false);
  });

  it("counts what is already downloaded against the cap", () => {
    const zones = planDownloads({ ...base, existing: [pack({ center: BUENOS_AIRES, bytes: 399_000_000 })] });
    expect(zones).toEqual([]);
  });

  it("without a location prefers the newest places when the cap cuts", () => {
    const photos = [
      { lat: CALAFATE[1], lng: CALAFATE[0], takenAt: 1 },
      { lat: BUENOS_AIRES[1], lng: BUENOS_AIRES[0], takenAt: 2 },
    ];
    const zones = planDownloads({ ...base, location: null, trips: [{ trip, photos }], capBytes: 15_000_000 });
    expect(zones).toHaveLength(1);
    expect(distanceKm(zones[0]!.center, BUENOS_AIRES)).toBeLessThan(5);
  });
});

describe("selectExpired", () => {
  const endsAtByTrip = new Map([["t1", END]]);

  it("expires a pack 7 days after the end of its roll", () => {
    expect(selectExpired([pack()], endsAtByTrip, new Set(["t1"]), END + 7 * DAY - 1)).toEqual([]);
    expect(selectExpired([pack()], endsAtByTrip, new Set(["t1"]), END + 7 * DAY)).toEqual([pack()]);
  });

  it("falls back to the stored expiry when the roll's dates are unknown", () => {
    const p = pack({ expiresAt: 1000 });
    expect(selectExpired([p], new Map(), new Set(["t1"]), 999)).toEqual([]);
    expect(selectExpired([p], new Map(), new Set(["t1"]), 1000)).toEqual([p]);
  });

  it("expires packs of rolls the person no longer has", () => {
    expect(selectExpired([pack()], endsAtByTrip, new Set(), START)).toEqual([pack()]);
  });
});

describe("networkAllows", () => {
  const wifi = { connected: true, wifi: true };
  const cellular = { connected: true, wifi: false };
  const offline = { connected: false, wifi: false };

  it("needs Wi-Fi before the roll starts", () => {
    expect(networkAllows(trip, wifi, START - DAY)).toBe(true);
    expect(networkAllows(trip, cellular, START - DAY)).toBe(false);
  });

  it("accepts any connection from the start", () => {
    expect(networkAllows(trip, cellular, START)).toBe(true);
    expect(networkAllows(trip, cellular, START + 3 * DAY)).toBe(true);
  });

  it("never downloads offline", () => {
    expect(networkAllows(trip, offline, START + DAY)).toBe(false);
  });
});

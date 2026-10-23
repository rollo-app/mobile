import { CITY_ZOOM, fitTarget, isTripActive, photosNear, startView, startZoom, USER_ZOOM, WORLD_VIEW } from "../framing";
import { toFeatures, type MapItem } from "../features";

describe("isTripActive", () => {
  const trip = { startsAt: 1_000, endsAt: 2_000 };
  it("is in progress between the start and the end", () => {
    expect(isTripActive(trip, 1_500)).toBe(true);
    expect(isTripActive(trip, 1_000)).toBe(true);
  });
  it("not before or after", () => {
    expect(isTripActive(trip, 999)).toBe(false);
    expect(isTripActive(trip, 2_001)).toBe(false);
  });
});

describe("fitTarget", () => {
  it("frames the box when the pins are spread out", () => {
    expect(fitTarget([-73, -50, -72, -49])).toEqual({ kind: "bounds", bounds: [-73, -50, -72, -49] });
  });

  it("if they are all together (or just one) it centers with zoom 15 as the cap", () => {
    const t = fitTarget([-72.89, -49.33, -72.8899, -49.3299]);
    expect(t.kind).toBe("center");
    if (t.kind === "center") {
      expect(t.zoom).toBe(15);
      expect(t.center[0]).toBeCloseTo(-72.88995, 4);
    }
  });
});

const item = (id: string, lng: number, lat: number, takenAt = 1): MapItem => ({
  id, type: "photo", takenAt, day: "d", lat, lng, caption: null, durationS: null, thumbhash: null,
  authorId: "a", authorName: "A", authorAvatarUrl: null, pending: false,
});
const none = { day: null, authorId: null };

describe("photosNear", () => {
  it("groups the photos at the same coordinates", () => {
    const { features } = toFeatures([item("b", -72.9, -49.3, 20), item("a", -72.9, -49.3, 10), item("z", -72.5, -49.1, 5)], none);
    expect(photosNear(features, [-72.9, -49.3], 12).map((f) => f.properties.id).sort()).toEqual(["a", "b"]);
  });

  it("groups those within a few pixels depending on the zoom", () => {
    // ~0.0005° ≈ 55 m: at zoom 12 it is ~2 px, at zoom 18 it is ~100 px
    const { features } = toFeatures([item("a", -72.9, -49.3), item("b", -72.9005, -49.3)], none);
    expect(photosNear(features, [-72.9, -49.3], 12)).toHaveLength(2);
    expect(photosNear(features, [-72.9, -49.3], 18)).toHaveLength(1);
  });

  it("returns at least the tapped one even if the point does not match exactly", () => {
    const { features } = toFeatures([item("a", -72.9, -49.3)], none);
    expect(photosNear(features, [-72.9, -49.3], 20).map((f) => f.properties.id)).toEqual(["a"]);
  });
});

describe("startView", () => {
  const here: [number, number] = [-56.16, -34.9];
  const spread: [number, number, number, number] = [-58, -35, -56, -34];
  const padding = { top: 10, right: 20, bottom: 30, left: 40 };

  it("with the trip in progress and a position, starts where you are", () => {
    expect(startView({ active: true, position: here, bounds: spread, padding })).toEqual({ center: here, zoom: USER_ZOOM });
  });

  it("otherwise, with pins, frames them all", () => {
    expect(startView({ active: false, position: here, bounds: spread, padding })).toEqual({ bounds: spread, padding });
    expect(startView({ active: true, position: null, bounds: spread, padding })).toEqual({ bounds: spread, padding });
  });

  it("with all the pins at one spot, centers on them with the framing zoom cap", () => {
    expect(startView({ active: false, position: null, bounds: [-56, -34, -56, -34], padding })).toEqual({ center: [-56, -34], zoom: 15 });
  });

  it("with no pins but a position, starts where you are at city level", () => {
    expect(startView({ active: false, position: here, bounds: null, padding })).toEqual({ center: here, zoom: CITY_ZOOM });
  });

  it("with nothing, shows the whole world", () => {
    expect(startView({ active: false, position: null, bounds: null, padding })).toEqual(WORLD_VIEW);
    expect(startView({ active: true, position: null, bounds: null, padding })).toEqual(WORLD_VIEW);
    expect(WORLD_VIEW.zoom).toBeLessThanOrEqual(2);
  });
});

describe("startZoom", () => {
  it("is the view's zoom when it has one", () => {
    expect(startZoom({ center: [0, 0], zoom: 12 })).toBe(12);
    expect(startZoom(WORLD_VIEW)).toBe(WORLD_VIEW.zoom);
  });

  it("estimates it from the span when the view is a box", () => {
    const wide = startZoom({ bounds: [-80, -50, -40, -20] });
    const narrow = startZoom({ bounds: [-72.9, -49.4, -72, -48.5] });
    expect(narrow).toBeGreaterThan(wide);
    expect(narrow).toBeGreaterThan(7);
    expect(narrow).toBeLessThanOrEqual(15);
  });
});

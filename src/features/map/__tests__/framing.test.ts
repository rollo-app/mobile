import { canExpandCluster, fitTarget, isTripActive, photosNear } from "../framing";
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
  authorId: "a", authorName: "A", pending: false,
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

describe("canExpandCluster", () => {
  it("opens by zooming if the needed zoom is within the maximum", () => {
    expect(canExpandCluster(14, 12)).toBe(true);
  });
  it("does not open if it needs more zoom than the maximum (photos at the same point)", () => {
    expect(canExpandCluster(18, 12)).toBe(false);
    expect(canExpandCluster(undefined, 12)).toBe(false);
  });
  it("does not open if we are already at max zoom", () => {
    expect(canExpandCluster(17, 17)).toBe(false);
    expect(canExpandCluster(17, 16.8)).toBe(false);
  });
});

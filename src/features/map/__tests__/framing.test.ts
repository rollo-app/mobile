import { fitTarget, isTripActive, photosNear } from "../framing";
import { toFeatures, type MapItem } from "../features";

describe("isTripActive", () => {
  const trip = { startsAt: 1_000, endsAt: 2_000 };
  it("está en curso entre el inicio y el fin", () => {
    expect(isTripActive(trip, 1_500)).toBe(true);
    expect(isTripActive(trip, 1_000)).toBe(true);
  });
  it("antes o después no", () => {
    expect(isTripActive(trip, 999)).toBe(false);
    expect(isTripActive(trip, 2_001)).toBe(false);
  });
});

describe("fitTarget", () => {
  it("encuadra la caja cuando los pins están repartidos", () => {
    expect(fitTarget([-73, -50, -72, -49])).toEqual({ kind: "bounds", bounds: [-73, -50, -72, -49] });
  });

  it("si están todos juntos (o es uno solo) centra con un zoom que no pasa el del clustering", () => {
    const t = fitTarget([-72.89, -49.33, -72.8899, -49.3299]);
    expect(t.kind).toBe("center");
    if (t.kind === "center") {
      expect(t.zoom).toBeLessThanOrEqual(14);
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
  it("junta las fotos en las mismas coordenadas", () => {
    const { features } = toFeatures([item("b", -72.9, -49.3, 20), item("a", -72.9, -49.3, 10), item("z", -72.5, -49.1, 5)], none);
    expect(photosNear(features, [-72.9, -49.3], 12).map((f) => f.properties.id).sort()).toEqual(["a", "b"]);
  });

  it("junta las que quedan a pocos píxeles según el zoom", () => {
    // ~0.0005° ≈ 55 m: a zoom 12 son ~ 2 px, a zoom 18 son ~ 100 px
    const { features } = toFeatures([item("a", -72.9, -49.3), item("b", -72.9005, -49.3)], none);
    expect(photosNear(features, [-72.9, -49.3], 12)).toHaveLength(2);
    expect(photosNear(features, [-72.9, -49.3], 18)).toHaveLength(1);
  });

  it("devuelve al menos la tocada aunque el punto no coincida exacto", () => {
    const { features } = toFeatures([item("a", -72.9, -49.3)], none);
    expect(photosNear(features, [-72.9, -49.3], 20).map((f) => f.properties.id)).toEqual(["a"]);
  });
});

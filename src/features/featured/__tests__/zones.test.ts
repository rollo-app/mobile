import { zoneBounds, zoneFeatures, zonesOf } from "../zones";

const at = (lat: number, lng: number) => ({ zone: { lat, lng } });
const nowhere = { zone: null };

describe("zonesOf", () => {
  it("groups photos by zone and counts them, biggest first", () => {
    const zones = zonesOf([at(-41.075, -71.475), at(-49.325, -72.875), at(-41.075, -71.475), nowhere, at(-41.075, -71.475)]);

    expect(zones).toEqual([
      { id: "zone:-41.075,-71.475", lat: -41.075, lng: -71.475, count: 3 },
      { id: "zone:-49.325,-72.875", lat: -49.325, lng: -72.875, count: 1 },
    ]);
  });

  it("ignores photos without a zone", () => {
    expect(zonesOf([nowhere, nowhere])).toEqual([]);
    expect(zonesOf([])).toEqual([]);
  });
});

describe("zoneFeatures", () => {
  it("is one point per zone with its id and count, nothing else", () => {
    const collection = zoneFeatures([{ id: "zone:-41.075,-71.475", lat: -41.075, lng: -71.475, count: 3 }]);

    expect(collection).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-71.475, -41.075] },
          properties: { id: "zone:-41.075,-71.475", count: 3 },
        },
      ],
    });
  });
});

describe("zoneBounds", () => {
  it("is [west, south, east, north] over all zones", () => {
    expect(
      zoneBounds([
        { id: "a", lat: -41.075, lng: -71.475, count: 1 },
        { id: "b", lat: -49.325, lng: -72.875, count: 2 },
      ]),
    ).toEqual([-72.875, -49.325, -71.475, -41.075]);
  });

  it("is null without zones", () => {
    expect(zoneBounds([])).toBeNull();
  });
});

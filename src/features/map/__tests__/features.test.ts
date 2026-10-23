import { memberColor } from "../member-color";
import { boundsOf, itemsByTime, mergeItems, pendingToItems, toFeatures, type MapItem } from "../features";

const item = (over: Partial<MapItem> = {}): MapItem => ({
  id: "m1",
  type: "photo",
  takenAt: 1_800_000_000_000,
  day: "2027-01-12",
  lat: -49.33,
  lng: -72.89,
  caption: null,
  durationS: null,
  thumbhash: null,
  authorId: "a1",
  authorName: "Cami",
  authorAvatarUrl: null,
  pending: false,
  ...over,
});

const none = { day: null, authorId: null };

describe("toFeatures", () => {
  it("turns each photo into a [lng, lat] point with its author's initial and color", () => {
    const { features } = toFeatures([item()], none);
    expect(features).toHaveLength(1);
    expect(features[0]!.geometry).toEqual({ type: "Point", coordinates: [-72.89, -49.33] });
    expect(features[0]!.properties).toEqual({ id: "m1", initial: "C", color: memberColor("a1"), pending: false, avatar: "" });
  });

  it("uses the uppercase initial even if the name is lowercase or has spaces", () => {
    const { features } = toFeatures([item({ authorName: "  juani" })], none);
    expect(features[0]!.properties.initial).toBe("J");
  });

  it("discards what has no location", () => {
    const { features } = toFeatures([item({ lat: null, lng: null }), item({ id: "m2", lat: null })], none);
    expect(features).toEqual([]);
  });

  it("flags the pending ones", () => {
    const { features } = toFeatures([item({ pending: true })], none);
    expect(features[0]!.properties.pending).toBe(true);
  });

  it("filters by day", () => {
    const items = [item({ id: "a", day: "2027-01-12" }), item({ id: "b", day: "2027-01-13" })];
    const { features } = toFeatures(items, { day: "2027-01-13", authorId: null });
    expect(features.map((f) => f.properties.id)).toEqual(["b"]);
  });

  it("filters by person", () => {
    const items = [item({ id: "a", authorId: "a1" }), item({ id: "b", authorId: "a2", authorName: "Mati" })];
    const { features } = toFeatures(items, { day: null, authorId: "a2" });
    expect(features.map((f) => f.properties.id)).toEqual(["b"]);
  });

  it("combines the filters", () => {
    const items = [
      item({ id: "a", authorId: "a1", day: "2027-01-12" }),
      item({ id: "b", authorId: "a2", day: "2027-01-12" }),
      item({ id: "c", authorId: "a2", day: "2027-01-13" }),
    ];
    const { features } = toFeatures(items, { day: "2027-01-12", authorId: "a2" });
    expect(features.map((f) => f.properties.id)).toEqual(["b"]);
  });
});

describe("mergeItems", () => {
  it("adds the pending ones to the feed", () => {
    const merged = mergeItems([item({ id: "a" })], [item({ id: "b", pending: true })]);
    expect(merged.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("if a pending one is already in the feed (just uploaded) the server's wins", () => {
    const merged = mergeItems([item({ id: "a" })], [item({ id: "a", pending: true })]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.pending).toBe(false);
  });
});

describe("boundsOf", () => {
  it("with no points there is no box", () => {
    expect(boundsOf([])).toBeNull();
  });

  it("covers all the points as [west, south, east, north]", () => {
    const { features } = toFeatures(
      [item({ id: "a", lng: -72.9, lat: -49.3 }), item({ id: "b", lng: -72.8, lat: -49.4 }), item({ id: "c", lng: -72.85, lat: -49.35 })],
      none,
    );
    expect(boundsOf(features)).toEqual([-72.9, -49.4, -72.8, -49.3]);
  });
});

describe("itemsByTime", () => {
  it("returns only the requested ids, oldest to newest", () => {
    const items = [item({ id: "c", takenAt: 30 }), item({ id: "a", takenAt: 10 }), item({ id: "b", takenAt: 20 }), item({ id: "x", takenAt: 5 })];
    expect(itemsByTime(items, ["c", "a", "b"]).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("pendingToItems", () => {
  it("turns your queue photos into pending items with your name", () => {
    const queued = {
      id: "q1", tripId: "t", type: "video" as const, takenAt: 5, day: "2027-01-12", lat: null, lng: null,
      accuracyM: null, caption: "hola", durationS: 12, width: 1, height: 1, sizeBytes: 1,
      originalUri: "o", thumbUri: "t", thumbhash: "hash", attempts: 0, retryAt: null,
    };

    expect(pendingToItems([queued], { id: "m1", name: "Juani" })).toEqual([
      {
        id: "q1", type: "video", takenAt: 5, day: "2027-01-12", lat: null, lng: null, caption: "hola",
        durationS: 12, thumbhash: "hash", authorId: "m1", authorName: "Juani", authorUsername: null, authorAvatarUrl: null, pending: true,
      },
    ]);
  });
});

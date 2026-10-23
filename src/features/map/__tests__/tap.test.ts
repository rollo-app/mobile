import { toFeatures, type MapItem } from "../features";
import { CLUSTER_LEAF_LIMIT, resolveTap } from "../tap";

const item = (id: string, lng: number, lat: number): MapItem => ({
  id, type: "photo", takenAt: 1, day: "d", lat, lng, caption: null, durationS: null, thumbhash: null,
  authorId: "a", authorName: "A", authorAvatarUrl: null, pending: false,
});
const { features } = toFeatures([item("a", -72.9, -49.3), item("b", -72.9, -49.3), item("far", -72.0, -48.0)], { day: null, authorId: null });
const [a, b, far] = features as [(typeof features)[number], (typeof features)[number], (typeof features)[number]];

describe("resolveTap", () => {
  it("a single pin gives the photos at that same spot", async () => {
    const getLeaves = jest.fn();
    const tap = await resolveTap(a, { features, zoom: 12, getLeaves });
    expect(tap.ids.sort()).toEqual(["a", "b"]);
    expect(tap.clusterId).toBeNull();
    expect(getLeaves).not.toHaveBeenCalled();
  });

  it("a cluster gives all its leaves (with a high limit) and remembers which cluster it was", async () => {
    const cluster: GeoJSON.Feature = {
      type: "Feature",
      geometry: a.geometry,
      properties: { cluster: true, cluster_id: 7, point_count: 3 },
    };
    const getLeaves = jest.fn().mockResolvedValue([a, far, b]);

    const tap = await resolveTap(cluster, { features, zoom: 8, getLeaves });

    expect(getLeaves).toHaveBeenCalledWith(7, CLUSTER_LEAF_LIMIT, 0);
    expect(tap).toEqual({ ids: ["a", "far", "b"], clusterId: 7 });
  });

  it("ignores leaves without an id", async () => {
    const cluster: GeoJSON.Feature = { type: "Feature", geometry: a.geometry, properties: { cluster: true, cluster_id: 1 } };
    const getLeaves = jest.fn().mockResolvedValue([a, { type: "Feature", geometry: a.geometry, properties: {} }]);
    expect((await resolveTap(cluster, { features, zoom: 8, getLeaves })).ids).toEqual(["a"]);
  });
});

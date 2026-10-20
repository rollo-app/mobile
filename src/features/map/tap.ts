import type { PinFeature } from "./features";
import { photosNear } from "./framing";

/** Max photos pulled from a tapped cluster into the carousel. */
export const CLUSTER_LEAF_LIMIT = 500;

export type Tap = {
  /** Ids of the photos for the carousel. */
  ids: string[];
  /** The tapped cluster (to keep it highlighted); null when it was a single pin. */
  clusterId: number | null;
};

/** What a tap on the pins layer shows: the photos at that spot or all the leaves of the cluster. */
export async function resolveTap(
  feature: GeoJSON.Feature,
  ctx: {
    features: PinFeature[];
    zoom: number;
    getLeaves: (clusterId: number, limit: number, offset: number) => Promise<GeoJSON.Feature[]>;
  },
): Promise<Tap> {
  const props = feature.properties ?? {};
  if (!props.cluster) {
    const center = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
    return { ids: photosNear(ctx.features, center, ctx.zoom).map((f) => f.properties.id), clusterId: null };
  }
  const leaves = await ctx.getLeaves(props.cluster_id, CLUSTER_LEAF_LIMIT, 0);
  const ids = leaves.map((l) => l.properties?.id).filter((id): id is string => typeof id === "string");
  return { ids, clusterId: props.cluster_id };
}

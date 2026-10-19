import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import base from "./positron.json";

/**
 * Custom map style: starts from OpenFreeMap's "positron" (local copy, so the style doesn't
 * depend on the network) and changes its palette: almost-white land, muted blue-gray water,
 * thin gray roads, almost no points of interest and small labels. Only the pins have color.
 */

export type MapScheme = "light" | "dark";

const palettes = {
  light: {
    land: "#f4f4f2",
    park: "#eeefec",
    water: "#cfd6dc",
    road: "#d6d6d3",
    roadMajor: "#c6c6c3",
    border: "#b9b9b6",
    text: "#8a8a87",
    halo: "#f4f4f2",
    ice: "#fbfbfa",
  },
  dark: {
    land: "#1c1c1e",
    park: "#202022",
    water: "#2a3138",
    road: "#333335",
    roadMajor: "#434345",
    border: "#505053",
    text: "#8e8e93",
    halo: "#1c1c1e",
    ice: "#242426",
  },
} as const;

type Layer = { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown>; [k: string]: unknown };

/** Layers not needed: buildings, rails, airports, route shields, minor boundaries. */
const REMOVED = /^(tunnel_|aeroway|road_area_pier|road_pier|railway|highway_motorway_bridge|highway-shield|road_shield|airport|boundary_3|boundary_disputed|highway-name-path|building)/;

/** Shrinks a `text-size`: plain number or `interpolate` / `step` (the values sit at the output positions). */
function scaleSize(size: unknown, factor: number): unknown {
  if (typeof size === "number") return size * factor;
  if (!Array.isArray(size)) return size;
  const [kind] = size;
  if (kind === "interpolate") {
    return size.map((v, i) => (i >= 4 && i % 2 === 0 && typeof v === "number" ? v * factor : v));
  }
  return size;
}

function restyle(layer: Layer, p: (typeof palettes)[MapScheme]): Layer {
  const paint: Record<string, unknown> = { ...layer.paint };
  const layout: Record<string, unknown> = { ...layer.layout };
  const id = layer.id;

  if (id === "background") paint["background-color"] = p.land;
  else if (id === "water") paint["fill-color"] = p.water;
  else if (id === "waterway") paint["line-color"] = p.water;
  else if (id === "landcover_ice_shelf" || id === "landcover_glacier") paint["fill-color"] = p.ice;
  else if (layer.type === "fill") paint["fill-color"] = p.park;
  else if (id === "boundary_2") paint["line-color"] = p.border;
  else if (id.endsWith("_casing")) paint["line-opacity"] = 0;
  else if (layer.type === "line" && id.startsWith("highway")) {
    paint["line-color"] = id.includes("minor") ? p.road : p.roadMajor;
    paint["line-opacity"] = 1;
    // Thin roads: all widths halved.
    const w = paint["line-width"];
    if (Array.isArray(w) && w[0] === "interpolate") {
      paint["line-width"] = w.map((v, i) => (i >= 4 && i % 2 === 0 && typeof v === "number" ? v * 0.5 : v));
    }
  } else if (layer.type === "symbol") {
    paint["text-color"] = p.text;
    paint["text-halo-color"] = p.halo;
    paint["text-halo-width"] = 1.2;
    layout["text-size"] = scaleSize(layout["text-size"], 0.82);
    // No city dots: just the name.
    delete layout["icon-image"];
    delete layout["icon-size"];
  }
  return { ...layer, paint, layout };
}

export function buildMapStyle(scheme: MapScheme): StyleSpecification {
  const p = palettes[scheme];
  const { ne2_shaded: _unused, ...sources } = base.sources;
  const layers = (base.layers as Layer[]).filter((l) => !REMOVED.test(l.id)).map((l) => restyle(l, p));
  return { ...base, sources, layers } as unknown as StyleSpecification;
}

/** OpenFreeMap style as is, for comparison. */
export const OPENFREEMAP_POSITRON = "https://tiles.openfreemap.org/styles/positron";
export const OPENFREEMAP_LIBERTY = "https://tiles.openfreemap.org/styles/liberty";

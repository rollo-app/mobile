// Everything the trip film's renderer paints with, loaded up front (JS thread): map images, photos and laid-out texts.
import { StaticMapImageManager } from "@maplibre/maplibre-react-native";
import { FontWeight, Skia, TextAlign, type SkImage, type SkParagraph } from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";
import { PixelRatio } from "react-native";
import { buildMapStyle } from "@/features/map/style";
import { writeStyleFile } from "@/features/map/style-file";
import type { ImageRef } from "../route";
import type { Assets, LayerAsset } from "./draw";
import type { MapLayerSpec, SceneText, Size } from "./model";

/** The film needs 2 pixels per point, not the device's 3. */
const DENSITY = 2;
/** Points of map above and below the layer, where the attribution mark lands. */
const BAND = 44;
const LAYER_TIMEOUT_MS = 12_000;
const PHOTO_TIMEOUT_MS = 15_000;
const SYSTEM_FONT = ".AppleSystemUIFont";

/** Rejects with `label timeout` after `ms`; the loser of the race keeps running but its result is dropped. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms} ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Runs `job(i)` for every index with at most `limit` in flight. */
async function pool(count: number, limit: number, job: (i: number) => Promise<void>): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < count) {
      const i = next++;
      await job(i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, count) }, worker));
}

function mercatorToLngLat(cx: number, cy: number): [number, number] {
  const lng = cx * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * cy))) * 180) / Math.PI;
  return [lng, lat];
}

/** Writes the dark map without its place names (every symbol layer) and returns its `file://` URI. */
function writeBareStyle(): string {
  const style = buildMapStyle("dark");
  const file = new File(Paths.cache, "journey-style-bare.json");
  file.create({ overwrite: true });
  file.write(JSON.stringify({ ...style, layers: style.layers.filter((layer) => layer.type !== "symbol") }));
  return file.uri;
}

/** MapLibre hands back a bare path ("/var/mobile/…/x.png"); Skia and `File` need a URI, and Skia reads a bare path as nothing. */
function fileUri(path: string): string {
  return path.startsWith("/") ? `file://${path}` : path;
}

function removeFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // a leftover snapshot is not worth failing for
  }
}

/** One map image. MapLibre writes it as a PNG into Documents and never removes it: it is read into memory and deleted. */
async function snapshot(spec: MapLayerSpec, styleUri: string, f: number, label: string): Promise<LayerAsset> {
  const bodyH = Math.round(spec.h / f);
  const totalH = bodyH + 2 * BAND;
  const pending = StaticMapImageManager.createImage({
    mapStyle: styleUri,
    center: mercatorToLngLat(spec.cx, spec.cy),
    zoom: spec.zoom - Math.log2(f),
    width: Math.round(spec.w / f),
    height: totalH,
    output: "file",
  });
  let abandoned = false;
  // A snapshot that lands after its timeout still wrote its file.
  pending.then(
    (late) => {
      if (abandoned) removeFile(fileUri(String(late)));
    },
    () => undefined,
  );
  let uri: string;
  try {
    uri = fileUri(String(await withTimeout(pending, LAYER_TIMEOUT_MS, label)));
  } catch (e) {
    abandoned = true;
    throw e;
  }
  try {
    const data = await withTimeout(Skia.Data.fromURI(uri), LAYER_TIMEOUT_MS, `${label} read`);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) throw new Error("undecodable image");
    const band = (image.height() * BAND) / totalH;
    return { image, src: { x: 0, y: band, w: image.width(), h: image.height() - 2 * band } };
  } finally {
    removeFile(uri);
  }
}

/**
 * The map images of the last film. "Otra versión" plays the same route with another seed: asking MapLibre for the
 * same images again would be most of its wait.
 */
let lastLayers: { key: string; layers: (LayerAsset | null)[] } | null = null;

/** Asks MapLibre for every map image, two at a time with one retry for the ones that failed; a failed one is null. */
export async function loadLayers(specs: MapLayerSpec[], onProgress: (done: number, total: number) => void): Promise<(LayerAsset | null)[]> {
  const f = PixelRatio.get() / DENSITY;
  const key = JSON.stringify([f, specs]);
  const out: (LayerAsset | null)[] = lastLayers?.key === key ? [...lastLayers.layers] : new Array(specs.length).fill(null);
  const missing: number[] = [];
  for (let i = 0; i < specs.length; i++) if (!out[i]) missing.push(i);
  let done = specs.length - missing.length;
  onProgress(done, specs.length);

  if (missing.length > 0) {
    const styles = { named: writeStyleFile("dark"), bare: writeBareStyle() };
    const attempt = async (i: number, label: string) => {
      try {
        out[i] = await snapshot(specs[i]!, specs[i]!.labels ? styles.named : styles.bare, f, label);
      } catch {
        // left null: the caller decides what a missing image means
      }
    };

    await pool(missing.length, 2, async (k) => {
      await attempt(missing[k]!, `layer ${missing[k]!}`);
      done += 1;
      onProgress(done, specs.length);
    });
    // One more try for the ones that failed (a slow tile, usually), one at a time.
    for (const i of missing) if (!out[i]) await attempt(i, `layer ${i} retry`);
  }

  lastLayers = { key, layers: out };
  return out;
}

/** The photos of the last film by URI, for the same reason as `lastLayers`. Authors' avatars go through here too, under `avatar:<authorId>`. */
let lastPhotos = new Map<string, SkImage>();

export async function loadPhotos(photos: { id: string; image: ImageRef }[]): Promise<Record<string, SkImage | null>> {
  const out: Record<string, SkImage | null> = {};
  const kept = new Map<string, SkImage>();
  await pool(photos.length, 4, async (i) => {
    const { id, image } = photos[i]!;
    const known = lastPhotos.get(image.uri);
    if (known) {
      out[id] = known;
      kept.set(image.uri, known);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PHOTO_TIMEOUT_MS);
    try {
      const response = await fetch(image.uri, { headers: image.headers, signal: controller.signal });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const lazy = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
      // Decoded here, while loading: a lazily decoded photo costs its first frames on screen (a hitch right as it starts to develop).
      let decoded = lazy;
      try {
        decoded = lazy?.makeNonTextureImage() ?? lazy;
      } catch {
        decoded = lazy;
      }
      out[id] = decoded;
      if (decoded) kept.set(image.uri, decoded);
    } catch {
      out[id] = null;
    } finally {
      clearTimeout(timer);
    }
  });
  lastPhotos = kept;
  return out;
}

type TextStyle = { size: number; weight: FontWeight; opacity: number; letterSpacing?: number; maxLines: number; align?: TextAlign };

function styleFor(role: SceneText["role"], w: number): TextStyle {
  switch (role) {
    case "day":
      return { size: 0.082 * w, weight: FontWeight.Bold, opacity: 1, maxLines: 1 };
    case "place":
      return { size: 0.042 * w, weight: FontWeight.SemiBold, opacity: 0.85, maxLines: 2 };
    case "hookName":
      return { size: 0.075 * w, weight: FontWeight.Bold, opacity: 1, maxLines: 2 };
    case "hookStats":
      return { size: 0.04 * w, weight: FontWeight.Normal, opacity: 0.8, maxLines: 1 };
    case "kicker":
      return { size: 0.034 * w, weight: FontWeight.SemiBold, opacity: 0.75, letterSpacing: 1.5, maxLines: 1 };
    case "closingName":
      return { size: 0.085 * w, weight: FontWeight.Bold, opacity: 1, maxLines: 2 };
    case "closingStats":
      return { size: 0.042 * w, weight: FontWeight.Normal, opacity: 0.8, maxLines: 1 };
    // The end card is designed for a 430 pt wide frame and scales with it.
    case "endName":
      return { size: (22 / 430) * w, weight: FontWeight.SemiBold, opacity: 1, maxLines: 1 };
    case "badgeSmall":
      return { size: (10 / 430) * w, weight: FontWeight.Normal, opacity: 1, maxLines: 1 };
    case "badgeBig":
      return { size: (19 / 430) * w, weight: FontWeight.SemiBold, opacity: 1, maxLines: 1 };
    // The letter of an author's avatar (diameter 0.075 w); a grid cell's smaller one scales the paragraph down.
    case "initial":
      return { size: 0.075 * w * 0.42, weight: FontWeight.SemiBold, opacity: 1, maxLines: 1 };
    // The map credit: the app's caption size (12 pt at 430 pt wide), small and faint, at the bottom left.
    case "credit":
      return { size: (12 / 430) * w, weight: FontWeight.Normal, opacity: 0.4, maxLines: 1, align: TextAlign.Left };
  }
}

export function layoutTexts(texts: SceneText[], frame: Size): (SkParagraph | null)[] {
  return texts.map((entry) => {
    if (!entry.text) return null;
    try {
      const s = styleFor(entry.role, frame.w);
      const builder = Skia.ParagraphBuilder.Make({ maxLines: s.maxLines, ellipsis: "…", textAlign: s.align ?? TextAlign.Center });
      builder.pushStyle({
        color: Skia.Color(`rgba(255,255,255,${s.opacity})`),
        fontFamilies: [SYSTEM_FONT],
        fontSize: s.size,
        fontStyle: { weight: s.weight },
        letterSpacing: s.letterSpacing,
      });
      builder.addText(entry.text);
      const paragraph = builder.build();
      paragraph.layout(frame.w * 0.88);
      return paragraph;
    } catch {
      return null;
    }
  });
}

/** True when one of the map images is missing: the film cannot be shown. */
export function incomplete(assets: Assets): boolean {
  return assets.layers.some((layer) => layer === null);
}

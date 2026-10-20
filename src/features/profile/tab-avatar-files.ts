import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { decode, encode } from "fast-png";
import { renderTabAvatar, toRgba8, type RingOptions, type Rgb } from "./tab-avatar";

/** The icon is shown at 28 pt on a 3x screen. */
export const TAB_ICON_POINTS = 28;
export const TAB_ICON_SCALE = 3;
const SIZE = TAB_ICON_POINTS * TAB_ICON_SCALE;
const RING_WIDTH = 2 * TAB_ICON_SCALE - 1; // ~2 pt
const RING_GAP = TAB_ICON_SCALE; // ~1 pt

export type TabAvatarVariant = "default" | "selected";

export type TabAvatarFiles = { default: string; selected: string };

/** Stable short key from the avatar path (a new photo has a new path, so it regenerates). */
export function cacheKey(avatarUrl: string): string {
  let h = 5381;
  for (let i = 0; i < avatarUrl.length; i++) h = ((h * 33) ^ avatarUrl.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Makes (or reuses from the cache) the two circular PNGs of the tab: plain and selected with a ring.
 * Pure JS pixel work: no native modules beyond the ones already in the app.
 */
export async function ensureTabAvatarFiles(avatarUri: string, avatarUrl: string, tintHex: string): Promise<TabAvatarFiles> {
  const dir = new Directory(Paths.cache, "tab-avatar");
  dir.create({ intermediates: true, idempotent: true });
  // "v2": icons from before 16-bit PNGs were read correctly are discarded.
  const key = `v2-${cacheKey(avatarUrl)}-${tintHex.slice(1)}`;
  const plain = new File(dir, `${key}-default.png`);
  const selected = new File(dir, `${key}-selected.png`);
  if (plain.exists && selected.exists) return { default: plain.uri, selected: selected.uri };

  const download = new File(dir, `${key}-source`);
  const source = await File.downloadFileAsync(avatarUri, download, { idempotent: true });
  try {
    const ctx = ImageManipulator.manipulate(source.uri);
    ctx.resize({ width: SIZE, height: SIZE });
    const image = await ctx.renderAsync();
    const { base64 } = await image.saveAsync({ format: SaveFormat.PNG, base64: true });
    if (!base64) throw new Error("no base64 from manipulator");
    const png = decode(base64ToBytes(base64));
    const rgba = toRgba8(png);
    const ring: RingOptions = { color: hexToRgb(tintHex), width: RING_WIDTH, gap: RING_GAP };
    writePng(plain, renderTabAvatar(rgba, png.width), png.width);
    writePng(selected, renderTabAvatar(rgba, png.width, { ring }), png.width);
  } finally {
    try {
      if (download.exists) download.delete();
    } catch {
      // Cache file: the system cleans it up.
    }
  }
  return { default: plain.uri, selected: selected.uri };
}

function writePng(file: File, rgba: Uint8Array, size: number) {
  const bytes = encode({ width: size, height: size, data: rgba, channels: 4, depth: 8 });
  file.create({ overwrite: true, intermediates: true });
  file.write(bytes);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}


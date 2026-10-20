/**
 * Circular avatar images for the native tab bar. The tab bar only takes a bitmap (it doesn't mask
 * views), so the circle, the transparent gap and the selection ring are baked into RGBA pixels here.
 * Pure: no React or Expo imports.
 */

export type Rgb = [number, number, number];

export type RingOptions = {
  color: Rgb;
  /** Ring thickness in px, measured inwards from the edge. */
  width: number;
  /** Transparent gap in px between the ring and the photo. */
  gap: number;
};

const at = (a: ArrayLike<number>, i: number) => a[i] ?? 0;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Coverage of a pixel (0..1) at distance `d` from the center for a disc of radius `r` (antialiased). */
const disc = (d: number, r: number) => clamp01(r - d + 0.5);

/**
 * Square RGBA `src` (size × size) → circular RGBA. Without `ring` the photo fills the circle;
 * with it the photo shrinks to leave `gap` and `width` for the ring on the outside.
 */
export function renderTabAvatar(src: ArrayLike<number>, size: number, options: { ring?: RingOptions } = {}): Uint8Array {
  const { ring } = options;
  const out = new Uint8Array(size * size * 4);
  const c = size / 2;
  const outer = c;
  const inner = ring ? outer - ring.width : outer;
  const photoR = ring ? inner - ring.gap : outer;
  const scale = (2 * photoR) / size; // how much the source shrinks
  const offset = c - photoR;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      const aPhoto = disc(d, photoR);
      const aRing = ring ? disc(d, outer) * clamp01(d - inner + 0.5) : 0;
      const alpha = aPhoto + aRing;
      if (alpha <= 0) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      if (aPhoto > 0) {
        const [pr, pg, pb, pa] = sample(src, size, (x + 0.5 - offset) / scale - 0.5, (y + 0.5 - offset) / scale - 0.5);
        const w = aPhoto * (pa / 255);
        r += pr * w;
        g += pg * w;
        b += pb * w;
        const total = w + aRing;
        if (aRing > 0) {
          r += ring!.color[0] * aRing;
          g += ring!.color[1] * aRing;
          b += ring!.color[2] * aRing;
        }
        write(out, (y * size + x) * 4, r, g, b, total);
        continue;
      }
      r = ring!.color[0] * aRing;
      g = ring!.color[1] * aRing;
      b = ring!.color[2] * aRing;
      write(out, (y * size + x) * 4, r, g, b, aRing);
    }
  }
  return out;
}

function write(out: Uint8Array, i: number, r: number, g: number, b: number, weight: number) {
  if (weight <= 0) return;
  out[i] = Math.round(r / weight);
  out[i + 1] = Math.round(g / weight);
  out[i + 2] = Math.round(b / weight);
  out[i + 3] = Math.round(clamp01(weight) * 255);
}

/** Bilinear sample with the edge clamped. Handles RGBA with 4 channels. */
function sample(src: ArrayLike<number>, size: number, fx: number, fy: number): [number, number, number, number] {
  const x0 = Math.max(0, Math.min(size - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(size - 1, Math.floor(fy)));
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const tx = clamp01(fx - x0);
  const ty = clamp01(fy - y0);
  const res: [number, number, number, number] = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const a = at(src, (y0 * size + x0) * 4 + k) * (1 - tx) + at(src, (y0 * size + x1) * 4 + k) * tx;
    const b = at(src, (y1 * size + x0) * 4 + k) * (1 - tx) + at(src, (y1 * size + x1) * 4 + k) * tx;
    res[k] = a * (1 - ty) + b * ty;
  }
  return res;
}

/** What a PNG decoder hands back (fast-png's shape), without depending on it. */
export type DecodedPng = {
  width: number;
  height: number;
  data: ArrayLike<number>;
  channels: number;
  depth: number;
  palette?: ArrayLike<ArrayLike<number>>;
};

/**
 * Any decoded PNG to 8-bit RGBA. iOS may write 16-bit or indexed PNGs: reading a 16-bit sample as a byte
 * keeps only its low byte, which shows up as colored noise.
 */
export function toRgba8(png: DecodedPng): Uint8Array {
  const { width, height, data, channels, depth, palette } = png;
  const pixels = width * height;
  const out = new Uint8Array(pixels * 4);
  // Samples below 8 bits come packed, with each row starting on a new byte.
  const rowBytes = Math.ceil((width * channels * depth) / 8);
  const sample = (i: number): number => {
    if (depth === 16) return (data[i] ?? 0) >> 8;
    if (depth === 8) return data[i] ?? 0;
    const row = Math.floor(i / (width * channels));
    const bit = (i % (width * channels)) * depth;
    const byte = data[row * rowBytes + (bit >> 3)] ?? 0;
    return (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
  };
  const scale = (v: number) => (depth < 8 && !palette ? Math.round((v * 255) / ((1 << depth) - 1)) : v);

  for (let p = 0; p < pixels; p++) {
    const o = p * channels;
    let rgba: [number, number, number, number];
    if (palette) {
      const c = palette[sample(o)] ?? [0, 0, 0];
      rgba = [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, c[3] ?? 255];
    } else if (channels >= 3) {
      rgba = [sample(o), sample(o + 1), sample(o + 2), channels === 4 ? sample(o + 3) : 255];
    } else {
      const g = scale(sample(o));
      rgba = [g, g, g, channels === 2 ? sample(o + 1) : 255];
    }
    out.set(rgba, p * 4);
  }
  return out;
}

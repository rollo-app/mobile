export type RGB = { r: number; g: number; b: number };

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeBase64(text: string): Uint8Array | null {
  const clean = text.replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * The average color of a ThumbHash (base64), in 0–255. Port of `thumbHashToAverageRGBA` from the
 * reference implementation (evanw/thumbhash): the average lives in the header's LPQ DC terms.
 */
export function thumbHashAverageColor(base64: string): RGB | null {
  const hash = decodeBase64(base64);
  if (!hash || hash.length < 5) return null;
  const header = hash[0]! | (hash[1]! << 8) | (hash[2]! << 16);
  const l = (header & 63) / 63;
  const p = ((header >> 6) & 63) / 31.5 - 1;
  const q = ((header >> 12) & 63) / 31.5 - 1;
  const b = l - (2 / 3) * p;
  const r = (3 * l - b + q) / 2;
  const g = r - q;
  const to255 = (x: number) => Math.round(clamp01(x) * 255);
  return { r: to255(r), g: to255(g), b: to255(b) };
}

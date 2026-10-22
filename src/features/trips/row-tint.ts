import type { RGB } from "./thumbhash-color";

/** How much of the roll's color is replaced by white (light) or black (dark) so the label stays readable. */
const MIX = 0.6;

const mix = (c: number, target: number) => Math.round(c + (target - c) * MIX);

/**
 * The roll's color as a row tint: lightened toward white in light mode (black text on top) and
 * darkened toward black in dark mode (white text on top). Keeps the hue; AA contrast for any color.
 */
export function rowTint({ r, g, b }: RGB, scheme: "light" | "dark"): RGB {
  const target = scheme === "light" ? 255 : 0;
  return { r: mix(r, target), g: mix(g, target), b: mix(b, target) };
}

function luminance({ r, g, b }: RGB) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colors (1–21). */
export function contrastRatio(a: RGB, b: RGB) {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

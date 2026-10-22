import { contrastRatio, rowTint } from "../row-tint";

const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };
const SAMPLES = [
  BLACK,
  WHITE,
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
  { r: 255, g: 255, b: 0 },
  { r: 49, g: 86, b: 242 },
  { r: 86, g: 82, b: 88 },
];

describe("rowTint", () => {
  it.each(SAMPLES)("keeps black text readable in light mode on %o", (rgb) => {
    expect(contrastRatio(rowTint(rgb, "light"), BLACK)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SAMPLES)("keeps white text readable in dark mode on %o", (rgb) => {
    expect(contrastRatio(rowTint(rgb, "dark"), WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it("lightens in light mode and darkens in dark mode, keeping the hue", () => {
    const red = { r: 200, g: 40, b: 40 };
    const light = rowTint(red, "light");
    const dark = rowTint(red, "dark");
    expect(light.g).toBeGreaterThan(red.g);
    expect(dark.r).toBeLessThan(red.r);
    expect(light.r).toBeGreaterThan(light.g);
    expect(dark.r).toBeGreaterThan(dark.g);
  });
});

describe("contrastRatio", () => {
  it("is 21 between black and white and 1 for the same color", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21);
    expect(contrastRatio(WHITE, WHITE)).toBe(1);
  });
});

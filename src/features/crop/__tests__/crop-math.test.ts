import { clampOffset, clampZoom, cropRect, displayedSize, MAX_ZOOM, minScale, portraitFrame } from "../crop-math";

const portrait = { width: 1200, height: 1600 };
const landscape = { width: 4000, height: 3000 };
const D = 300;

describe("minScale", () => {
  it("makes the short side exactly as wide as the circle", () => {
    expect(minScale(portrait, D)).toBe(0.25);
    expect(minScale(landscape, D)).toBe(0.1);
  });
});

describe("displayedSize", () => {
  it("scales the photo by the cover scale times the zoom", () => {
    expect(displayedSize(portrait, D, 1)).toEqual({ width: 300, height: 400 });
    expect(displayedSize(portrait, D, 2)).toEqual({ width: 600, height: 800 });
  });
});

describe("clampZoom", () => {
  it("keeps the zoom between covering the circle and 4×", () => {
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(2.5)).toBe(2.5);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
    expect(MAX_ZOOM).toBe(4);
  });
});

describe("clampOffset", () => {
  it("lets the photo move only along its spare length", () => {
    // 300×400 on screen: no room sideways, 50 px up or down.
    expect(clampOffset({ x: 80, y: 120 }, portrait, D, 1)).toEqual({ x: 0, y: 50 });
    expect(clampOffset({ x: -80, y: -120 }, portrait, D, 1)).toEqual({ x: 0, y: -50 });
  });

  it("allows more room when zoomed in", () => {
    // 600×800 on screen: 150 px sideways, 250 px up or down.
    expect(clampOffset({ x: 200, y: -100 }, portrait, D, 2)).toEqual({ x: 150, y: -100 });
  });

  it("keeps an offset that already fits", () => {
    expect(clampOffset({ x: 0, y: 10 }, portrait, D, 1)).toEqual({ x: 0, y: 10 });
  });
});

describe("cropRect", () => {
  it("crops the centered square of the short side at zoom 1", () => {
    expect(cropRect(portrait, D, 1, { x: 0, y: 0 })).toEqual({ originX: 0, originY: 200, width: 1200, height: 1200 });
    expect(cropRect(landscape, D, 1, { x: 0, y: 0 })).toEqual({ originX: 500, originY: 0, width: 3000, height: 3000 });
  });

  it("moving the photo down shows its top", () => {
    expect(cropRect(portrait, D, 1, { x: 0, y: 50 })).toEqual({ originX: 0, originY: 0, width: 1200, height: 1200 });
  });

  it("zooming in crops a smaller square around the circle's center", () => {
    expect(cropRect(portrait, D, 2, { x: 0, y: 0 })).toEqual({ originX: 300, originY: 500, width: 600, height: 600 });
    // Photo moved 150 px right (screen) = 300 source px: the circle sees the left edge.
    expect(cropRect(portrait, D, 2, { x: 150, y: 0 })).toEqual({ originX: 0, originY: 500, width: 600, height: 600 });
  });

  it("never leaves the photo's bounds, even with an unclamped offset", () => {
    expect(cropRect(portrait, D, 1, { x: 500, y: -500 })).toEqual({ originX: 0, originY: 400, width: 1200, height: 1200 });
  });
});

describe("portrait frame (3:4)", () => {
  const frame = { width: 300, height: 400 };

  it("frame math keeps working with a number (square) as before", () => {
    expect(minScale(portrait, 300)).toBe(minScale(portrait, { width: 300, height: 300 }));
  });

  it("portraitFrame is the largest 3:4 frame that fits the gutters and the available height", () => {
    expect(portraitFrame(390, 700, 16)).toEqual({ width: 357, height: 476 });
    // Short screen: height-bound, width follows at 3:4.
    expect(portraitFrame(390, 300, 16)).toEqual({ width: 225, height: 300 });
  });

  it("covers the frame: a 3:4 photo fits exactly at zoom 1 and cannot move", () => {
    expect(displayedSize(portrait, frame, 1)).toEqual({ width: 300, height: 400 });
    expect(clampOffset({ x: 50, y: 50 }, portrait, frame, 1)).toEqual({ x: 0, y: 0 });
  });

  it("crops a centered 3:4 rect from a 4000x3000 landscape source", () => {
    expect(cropRect(landscape, frame, 1, { x: 0, y: 0 })).toEqual({ originX: 875, originY: 0, width: 2250, height: 3000 });
  });

  it("crops the whole 3000x4000 portrait source at zoom 1", () => {
    expect(cropRect({ width: 3000, height: 4000 }, frame, 1, { x: 0, y: 0 })).toEqual({ originX: 0, originY: 0, width: 3000, height: 4000 });
  });

  it("zoomed and dragged crops stay 3:4 and inside the photo", () => {
    const image = { width: 4000, height: 3000 };
    for (const [zoom, offset] of [[2, { x: 999, y: -999 }], [4, { x: -999, y: 999 }], [1.5, { x: 10, y: 5 }]] as const) {
      const r = cropRect(image, frame, zoom, offset);
      expect(Math.abs(r.width / r.height - 0.75)).toBeLessThan(0.002);
      expect(r.originX).toBeGreaterThanOrEqual(0);
      expect(r.originY).toBeGreaterThanOrEqual(0);
      expect(r.originX + r.width).toBeLessThanOrEqual(image.width);
      expect(r.originY + r.height).toBeLessThanOrEqual(image.height);
    }
  });
});

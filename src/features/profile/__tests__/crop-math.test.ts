import { clampOffset, clampZoom, cropRect, displayedSize, MAX_ZOOM, minScale } from "../crop-math";

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

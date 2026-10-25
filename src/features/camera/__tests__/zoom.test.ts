import { activePreset, formatFactor, pinchZoom, touchDistance, zoomLevels, type ZoomDevice } from "../zoom";

// Real AVFoundation numbers: zoom factors are relative to the virtual device's widest lens, and
// `zoomLensSwitchFactors` (= virtualDeviceSwitchOverVideoZoomFactors) are where it hands over to the next lens.
const triple3x: ZoomDevice = {
  position: "back",
  minZoom: 1,
  maxZoom: 123.75,
  zoomLensSwitchFactors: [2, 6],
  physicalDevices: [{ type: "ultra-wide-angle" }, { type: "wide-angle" }, { type: "telephoto" }],
};
const triple5x: ZoomDevice = { ...triple3x, zoomLensSwitchFactors: [2, 10] };
const dualWide: ZoomDevice = {
  position: "back",
  minZoom: 1,
  maxZoom: 95.6,
  zoomLensSwitchFactors: [2],
  physicalDevices: [{ type: "ultra-wide-angle" }, { type: "wide-angle" }],
};
const dualTele: ZoomDevice = {
  position: "back",
  minZoom: 1,
  maxZoom: 16,
  zoomLensSwitchFactors: [2],
  physicalDevices: [{ type: "wide-angle" }, { type: "telephoto" }],
};
const wide: ZoomDevice = { position: "back", minZoom: 1, maxZoom: 16, zoomLensSwitchFactors: [], physicalDevices: [] };
const front: ZoomDevice = { position: "front", minZoom: 1, maxZoom: 16, zoomLensSwitchFactors: [], physicalDevices: [] };

describe("zoomLevels", () => {
  it("on a triple camera 1x is the wide lens (the first switch-over) and the chips are 0,5 · 1 · 2 · 3", () => {
    expect(zoomLevels(triple3x)).toEqual({ neutral: 2, min: 1, max: 30, presets: [0.5, 1, 2, 3] });
  });

  it("finds a 5x telephoto from the second switch-over, and lets the pinch go to 25x like the iPhone", () => {
    expect(zoomLevels(triple5x)).toEqual({ neutral: 2, min: 1, max: 50, presets: [0.5, 1, 2, 5] });
  });

  it("with an ultra-wide and no telephoto it offers 0,5 · 1 · 2 and caps the pinch at 10x", () => {
    expect(zoomLevels(dualWide)).toEqual({ neutral: 2, min: 1, max: 20, presets: [0.5, 1, 2] });
  });

  it("without an ultra-wide 1x is the minimum and there is no 0,5; a 2x telephoto is the 2 chip", () => {
    expect(zoomLevels(dualTele)).toEqual({ neutral: 1, min: 1, max: 10, presets: [1, 2] });
  });

  it("a single back lens gets 1 · 2 (digital), capped at what the device can do", () => {
    expect(zoomLevels(wide)).toEqual({ neutral: 1, min: 1, max: 10, presets: [1, 2] });
    expect(zoomLevels({ ...wide, maxZoom: 4 }).max).toBe(4);
  });

  it("the front camera has no chips, only the pinch", () => {
    expect(zoomLevels(front)).toEqual({ neutral: 1, min: 1, max: 10, presets: [] });
  });

  it("drops a 2 chip the device cannot reach", () => {
    expect(zoomLevels({ ...wide, maxZoom: 1.5 }).presets).toEqual([1]);
  });
});

describe("activePreset", () => {
  const presets = [0.5, 1, 2, 3];

  it("is the largest chip at or under the current zoom", () => {
    expect(activePreset(presets, 1)).toBe(1);
    expect(activePreset(presets, 1.4)).toBe(1);
    expect(activePreset(presets, 0.7)).toBe(0.5);
    expect(activePreset(presets, 2.5)).toBe(2);
    expect(activePreset(presets, 12)).toBe(3);
  });

  it("counts a zoom that rounds to a chip as that chip", () => {
    expect(activePreset(presets, 1.96)).toBe(2);
  });

  it("is undefined with no chips", () => {
    expect(activePreset([], 1)).toBeUndefined();
  });
});

describe("formatFactor", () => {
  it("uses one decimal with a comma, and none for whole numbers", () => {
    expect(formatFactor(0.5)).toBe("0,5");
    expect(formatFactor(1)).toBe("1");
    expect(formatFactor(1.43)).toBe("1,4");
    expect(formatFactor(1.96)).toBe("2");
    expect(formatFactor(3)).toBe("3");
  });
});

describe("pinchZoom", () => {
  const levels = zoomLevels(triple3x);

  it("scales the zoom with the fingers, like the iPhone's camera", () => {
    expect(pinchZoom(levels, 2, 100, 200)).toBe(4);
    expect(pinchZoom(levels, 4, 200, 100)).toBe(2);
  });

  it("stays between the device's real minimum and the cap", () => {
    expect(pinchZoom(levels, 2, 100, 10)).toBe(1);
    expect(pinchZoom(levels, 20, 100, 1000)).toBe(30);
  });

  it("does not move without a starting distance", () => {
    expect(pinchZoom(levels, 3, 0, 100)).toBe(3);
  });

  it("measures the distance between two touches", () => {
    expect(touchDistance([{ pageX: 0, pageY: 0 }, { pageX: 3, pageY: 4 }])).toBe(5);
    expect(touchDistance([{ pageX: 0, pageY: 0 }])).toBe(0);
  });
});

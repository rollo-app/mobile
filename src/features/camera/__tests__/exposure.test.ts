import { biasRange, dragBias, EV_STEP, formatBias, meteringModes, stepBias, sunOffset } from "../exposure";

const iphone = { supportsExposureBias: true, minExposureBias: -8, maxExposureBias: 8 };

describe("biasRange", () => {
  it("is the device's real exposure bias range", () => {
    expect(biasRange(iphone)).toEqual({ min: -8, max: 8 });
  });

  it("is null when the device cannot bias exposure (or reports an empty range)", () => {
    expect(biasRange({ supportsExposureBias: false, minExposureBias: 0, maxExposureBias: 0 })).toBeNull();
    expect(biasRange({ supportsExposureBias: true, minExposureBias: 0, maxExposureBias: 0 })).toBeNull();
  });
});

describe("dragBias", () => {
  const range = { min: -2, max: 2 };

  it("dragging up brightens and down darkens, 1 EV every 50 points", () => {
    expect(dragBias(range, 0, -50)).toBeCloseTo(1);
    expect(dragBias(range, 0, 25)).toBeCloseTo(-0.5);
    expect(dragBias(range, 1, -25)).toBeCloseTo(1.5);
  });

  it("clamps to the device's range", () => {
    expect(dragBias(range, 0, -1000)).toBe(2);
    expect(dragBias(range, 0, 1000)).toBe(-2);
  });
});

describe("stepBias (VoiceOver increment/decrement)", () => {
  const range = { min: -1, max: 1 };

  it("moves a third of a stop, like the iPhone's exposure control, within the range", () => {
    expect(EV_STEP).toBeCloseTo(1 / 3);
    expect(stepBias(range, 0, 1)).toBeCloseTo(1 / 3);
    expect(stepBias(range, 0, -1)).toBeCloseTo(-1 / 3);
    expect(stepBias(range, 0.9, 1)).toBe(1);
    expect(stepBias(range, -0.9, -1)).toBe(-1);
  });
});

describe("formatBias", () => {
  it("shows the EV with a sign and one decimal comma, and 0 plain", () => {
    expect(formatBias(0)).toBe("0");
    expect(formatBias(0.02)).toBe("0");
    expect(formatBias(2 / 3)).toBe("+0,7");
    expect(formatBias(-1.33)).toBe("-1,3");
    expect(formatBias(2)).toBe("+2");
  });
});

describe("sunOffset", () => {
  const range = { min: -8, max: 4 };

  it("places the sun along the slider: up for brighter, each side scaled to its own end of the range", () => {
    expect(sunOffset(range, 0, 60)).toBe(0);
    expect(sunOffset(range, 4, 60)).toBe(-60);
    expect(sunOffset(range, 2, 60)).toBe(-30);
    expect(sunOffset(range, -8, 60)).toBe(60);
    expect(sunOffset(range, -4, 60)).toBe(30);
  });
});

describe("meteringModes", () => {
  it("meters focus, exposure and white balance where the device can", () => {
    expect(meteringModes({ supportsFocusMetering: true, supportsExposureMetering: true, supportsWhiteBalanceMetering: true })).toEqual(["AF", "AE", "AWB"]);
  });

  it("a fixed-focus selfie camera still meters exposure on a tap", () => {
    expect(meteringModes({ supportsFocusMetering: false, supportsExposureMetering: true, supportsWhiteBalanceMetering: false })).toEqual(["AE"]);
    expect(meteringModes({ supportsFocusMetering: false, supportsExposureMetering: false, supportsWhiteBalanceMetering: false })).toEqual([]);
  });
});

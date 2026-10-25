import { nextFlash } from "../flash";
import { pinchZoom, touchDistance } from "../pinch-zoom";

describe("pinchZoom", () => {
  it("zooms in when the fingers spread and out when they close", () => {
    expect(pinchZoom(0, 100, 200)).toBeGreaterThan(0);
    expect(pinchZoom(0.5, 200, 100)).toBeLessThan(0.5);
  });

  it("stays between 0 and 1", () => {
    expect(pinchZoom(0, 100, 10)).toBe(0);
    expect(pinchZoom(0.9, 100, 1000)).toBe(1);
  });

  it("does not move without a starting distance", () => {
    expect(pinchZoom(0.3, 0, 100)).toBe(0.3);
  });

  it("measures the distance between two touches", () => {
    expect(touchDistance([{ pageX: 0, pageY: 0 }, { pageX: 3, pageY: 4 }])).toBe(5);
    expect(touchDistance([{ pageX: 0, pageY: 0 }])).toBe(0);
  });
});

describe("nextFlash", () => {
  it("rotates auto, on, off", () => {
    expect(nextFlash("auto")).toBe("on");
    expect(nextFlash("on")).toBe("off");
    expect(nextFlash("off")).toBe("auto");
  });
});

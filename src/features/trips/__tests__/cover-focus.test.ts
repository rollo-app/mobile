import { bandHeight, clampFocus, coverContentPosition, focusFromTop, stepFocus, topFromFocus } from "../cover-focus";

describe("coverContentPosition", () => {
  it("maps 0..1 to a vertical percentage", () => {
    expect(coverContentPosition(0)).toEqual({ top: "0%" });
    expect(coverContentPosition(0.2)).toEqual({ top: "20%" });
    expect(coverContentPosition(1)).toEqual({ top: "100%" });
  });

  it("centers without a focus and clamps out-of-range values", () => {
    expect(coverContentPosition(null)).toEqual({ top: "50%" });
    expect(coverContentPosition(undefined)).toEqual({ top: "50%" });
    expect(coverContentPosition(-1)).toEqual({ top: "0%" });
    expect(coverContentPosition(3)).toEqual({ top: "100%" });
  });

  it("does not leak float noise", () => {
    expect(coverContentPosition(0.1 + 0.2)).toEqual({ top: "30%" });
  });
});

describe("focus band math", () => {
  it("clamps the focus to 0..1", () => {
    expect(clampFocus(-0.2)).toBe(0);
    expect(clampFocus(1.4)).toBe(1);
    expect(clampFocus(0.4)).toBe(0.4);
  });

  it("steps by a tenth without float noise, clamped", () => {
    expect(stepFocus(0.2, 1)).toBe(0.3);
    expect(stepFocus(0.5, -1)).toBe(0.4);
    expect(stepFocus(0.95, 1)).toBe(1);
    expect(stepFocus(0.05, -1)).toBe(0);
  });

  it("gives the band the card's aspect over the photo's full width", () => {
    expect(bandHeight(300, 360)).toBe(150);
  });

  it("converts between focus and the band's top within the free travel", () => {
    expect(topFromFocus(0, 400, 150)).toBe(0);
    expect(topFromFocus(1, 400, 150)).toBe(250);
    expect(topFromFocus(0.5, 400, 150)).toBe(125);
    expect(focusFromTop(125, 400, 150)).toBe(0.5);
    expect(focusFromTop(-10, 400, 150)).toBe(0);
    expect(focusFromTop(999, 400, 150)).toBe(1);
  });

  it("has no travel when the band is as tall as the photo", () => {
    expect(focusFromTop(10, 150, 150)).toBe(0.5);
    expect(topFromFocus(0.3, 150, 150)).toBe(0);
  });
});

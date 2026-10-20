import { DISMISS_DISTANCE, DISMISS_VELOCITY, isDownwardDrag, shouldDismiss } from "../dismiss";

describe("shouldDismiss", () => {
  it("dismisses once dragged past the distance threshold", () => {
    expect(shouldDismiss(DISMISS_DISTANCE, 0)).toBe(true);
    expect(shouldDismiss(DISMISS_DISTANCE + 50, 0)).toBe(true);
  });

  it("springs back below the threshold when released slowly", () => {
    expect(shouldDismiss(DISMISS_DISTANCE - 1, 0)).toBe(false);
    expect(shouldDismiss(0, 0)).toBe(false);
  });

  it("dismisses on a fast downward fling even over a short distance", () => {
    expect(shouldDismiss(40, DISMISS_VELOCITY)).toBe(true);
  });

  it("ignores a fast fling that is too short or goes up", () => {
    expect(shouldDismiss(10, DISMISS_VELOCITY)).toBe(false);
    expect(shouldDismiss(-200, -3)).toBe(false);
    expect(shouldDismiss(60, -3)).toBe(false);
  });
});

describe("isDownwardDrag", () => {
  it("claims clearly vertical downward movement", () => {
    expect(isDownwardDrag(2, 20)).toBe(true);
  });

  it("rejects upward, diagonal and tiny movement so taps and holds keep working", () => {
    expect(isDownwardDrag(0, -30)).toBe(false);
    expect(isDownwardDrag(20, 24)).toBe(false);
    expect(isDownwardDrag(0, 4)).toBe(false);
  });
});

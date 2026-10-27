import { bottomPadding } from "../bottom-padding";

describe("bottomPadding", () => {
  it("rests at the safe area plus the margin with the keyboard closed", () => {
    expect(bottomPadding(0, 34, 16, 8)).toBe(50);
  });

  it("keeps the same total while the keyboard is still below the resting padding", () => {
    expect(bottomPadding(20, 34, 16, 8)).toBe(50);
  });

  it("follows the keyboard plus the small gap once it is above the resting padding", () => {
    expect(bottomPadding(336, 34, 16, 8)).toBe(344);
  });

  it("never jumps: grows monotonically with the keyboard height", () => {
    let previous = bottomPadding(0, 34, 16, 8);
    for (let h = 1; h <= 340; h++) {
      const next = bottomPadding(h, 34, 16, 8);
      expect(next).toBeGreaterThanOrEqual(previous);
      expect(next - previous).toBeLessThanOrEqual(1);
      previous = next;
    }
  });
});

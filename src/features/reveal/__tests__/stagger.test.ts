import { staggerDelay } from "../stagger";

describe("staggerDelay", () => {
  it.each(Array.from({ length: 12 }, (_, i) => i + 1))("gives %i cells distinct delays within [0, stagger)", (n) => {
    const delays = Array.from({ length: n }, (_, i) => staggerDelay(i, 2600));
    expect(new Set(delays.map((d) => Math.round(d))).size).toBe(n);
    for (const d of delays) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(2600);
    }
  });

  it("starts the first cell right away", () => {
    expect(staggerDelay(0, 2600)).toBe(0);
  });
});

import { REVEAL_TIMELINE } from "../timeline";

describe("REVEAL_TIMELINE", () => {
  it("develops, hits and shows the title in order, before the screen moves on", () => {
    const { developAt, hitAt, titleAt, totalMs } = REVEAL_TIMELINE;
    expect(developAt).toBeGreaterThan(0);
    expect(hitAt).toBeGreaterThan(developAt);
    expect(titleAt).toBeGreaterThan(hitAt);
    expect(totalMs).toBeGreaterThan(titleAt);
  });

  it("lets every cell finish developing by the hit", () => {
    const { developAt, hitAt, cellMs } = REVEAL_TIMELINE;
    expect(cellMs).toBeLessThanOrEqual(hitAt - developAt);
  });

  it("keeps the timings the owner approved", () => {
    expect(REVEAL_TIMELINE).toEqual({ developAt: 1200, hitAt: 5000, titleAt: 5400, cellMs: 2400, totalMs: 7000 });
  });
});

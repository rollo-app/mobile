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
    expect(REVEAL_TIMELINE).toMatchObject({ developAt: 1200, hitAt: 5000, titleAt: 5400, cellMs: 2400, totalMs: 7000 });
  });

  it("gives up waiting for the photos after a few seconds", () => {
    expect(REVEAL_TIMELINE.loadingTimeoutMs).toBe(6000);
  });

  describe("with Reduce Motion", () => {
    const { reduced, totalMs } = REVEAL_TIMELINE;

    it("fades the photos in, confirms with the haptic, then dims them under the title", () => {
      expect(reduced).toEqual({ fadeInMs: 800, hapticAt: 800, dimAt: 1400, dimMs: 600, dimOpacity: 0.25 });
    });

    it("plays the haptic once the photos are fully in, and dims after it, before the screen moves on", () => {
      expect(reduced.hapticAt).toBeGreaterThanOrEqual(reduced.fadeInMs);
      expect(reduced.dimAt).toBeGreaterThan(reduced.hapticAt);
      expect(reduced.dimAt + reduced.dimMs).toBeLessThan(totalMs);
    });
  });
});

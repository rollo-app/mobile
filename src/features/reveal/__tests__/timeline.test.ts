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
    expect(REVEAL_TIMELINE).toMatchObject({ developAt: 1200, hitAt: 5000, titleAt: 5400, cellMs: 2400, totalMs: 8000 });
  });

  it("shows the title for a while and fades out before the screen moves on", () => {
    const { titleAt, totalMs, outroMs } = REVEAL_TIMELINE;
    expect(totalMs - outroMs - (titleAt + 700)).toBeGreaterThanOrEqual(1000);
  });

  it("waits at most 2.5 s for the thumbs, less than the loading timeout", () => {
    expect(REVEAL_TIMELINE.thumbsCapMs).toBe(2500);
    expect(REVEAL_TIMELINE.thumbsCapMs).toBeLessThan(REVEAL_TIMELINE.loadingTimeoutMs);
  });

  it("gives up waiting for the photos after a few seconds", () => {
    expect(REVEAL_TIMELINE.loadingTimeoutMs).toBe(6000);
  });

  describe("with Reduce Motion", () => {
    it("moves on well before the full sequence ends", () => {
      expect(REVEAL_TIMELINE.reduced.totalMs).toBeLessThan(REVEAL_TIMELINE.totalMs);
    });

    const { reduced } = REVEAL_TIMELINE;

    it("fades the photos in, confirms with the haptic, then dims them under the title", () => {
      expect(reduced).toEqual({ fadeInMs: 800, hapticAt: 800, dimAt: 1400, dimMs: 600, dimOpacity: 0.25, totalMs: 3200 });
    });

    it("plays the haptic once the photos are fully in, and dims after it, before the screen moves on", () => {
      expect(reduced.hapticAt).toBeGreaterThanOrEqual(reduced.fadeInMs);
      expect(reduced.dimAt).toBeGreaterThan(reduced.hapticAt);
      expect(reduced.dimAt + reduced.dimMs).toBeLessThan(reduced.totalMs);
    });
  });
});

import { WINNER_TIMELINE } from "../winner-timeline";

describe("WINNER_TIMELINE", () => {
  it("keeps the agreed values", () => {
    expect(WINNER_TIMELINE).toMatchObject({ developMs: 2400, flashMs: 350, textDelayMs: 2700, confettiDelayMs: 2900 });
  });

  it("orders the beats: develop, then the flash, then the text, then the confetti", () => {
    const { developMs, flashMs, textDelayMs, confettiDelayMs } = WINNER_TIMELINE;
    expect(textDelayMs).toBeGreaterThanOrEqual(developMs + flashMs - 100); // the text comes in as the flash fades
    expect(confettiDelayMs).toBeGreaterThan(textDelayMs);
  });

  it("the confetti falls for about 2.4 s and Reduce Motion fades in 300 ms", () => {
    expect(WINNER_TIMELINE.confettiMs).toBe(2400);
    expect(WINNER_TIMELINE.reducedFadeMs).toBe(300);
  });

  it("waits for the thumb a short while, less than the loading safety net", () => {
    expect(WINNER_TIMELINE.thumbsCapMs).toBeLessThan(WINNER_TIMELINE.loadingTimeoutMs);
  });
});

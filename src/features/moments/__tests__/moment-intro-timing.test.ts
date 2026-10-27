import { momentIntroTiming } from "../moment-intro-timing";

describe("momentIntroTiming", () => {
  it("plays the Lottie with the haptic at the core's pop, the text after it and the end just after the ring closes", () => {
    expect(momentIntroTiming(false)).toEqual({ playLottie: true, hapticAt: 450, textAt: 600, doneAt: 1700 });
  });

  it("with Reduce Motion skips the animation, shows the text at once and finishes sooner", () => {
    const timing = momentIntroTiming(true);
    expect(timing.playLottie).toBe(false);
    expect(timing.textAt).toBe(0);
    expect(timing.doneAt).toBe(1200);
    expect(timing.doneAt).toBeLessThan(momentIntroTiming(false).doneAt);
  });

  it("while Reduce Motion is still unknown, plays the reduced version", () => {
    expect(momentIntroTiming(null)).toEqual(momentIntroTiming(true));
  });
});

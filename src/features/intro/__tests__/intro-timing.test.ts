import { introTiming } from "../intro-timing";

describe("introTiming", () => {
  it("plays the logo, then the first line at 1.4 s, the second 200 ms later and the button at 2.4 s", () => {
    expect(introTiming(false)).toEqual({ playLottie: true, firstLineAt: 1400, secondLineAt: 1600, buttonAt: 2400, moves: true });
  });

  it("with Reduce Motion keeps the logo still, fades only and shows the button from 0.8 s", () => {
    const t = introTiming(true);
    expect(t.playLottie).toBe(false);
    expect(t.moves).toBe(false);
    expect(t.buttonAt).toBe(800);
    expect(t.buttonAt).toBeLessThan(introTiming(false).buttonAt);
  });

  it("while Reduce Motion is unknown, uses the reduced version", () => {
    expect(introTiming(null)).toEqual(introTiming(true));
  });
});

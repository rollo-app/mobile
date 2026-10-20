import { resendSecondsLeft } from "../resend";

describe("resendSecondsLeft", () => {
  it("counts down from 60 s", () => {
    expect(resendSecondsLeft(1000, 1000)).toBe(60);
    expect(resendSecondsLeft(1000, 1000 + 59_001)).toBe(1);
  });

  it("is 0 once 60 s have passed", () => {
    expect(resendSecondsLeft(1000, 1000 + 60_000)).toBe(0);
    expect(resendSecondsLeft(1000, 1000 + 120_000)).toBe(0);
  });
});

import { sendExit } from "../send-exit";

describe("sendExit", () => {
  it("drops and shrinks the photo while it fades, under 300 ms", () => {
    const exit = sendExit(false);
    expect(exit).toEqual({ duration: 260, scale: 0.92, translateY: 24 });
  });

  it("with Reduce Motion only fades: no movement, no scale, shorter", () => {
    expect(sendExit(true)).toEqual({ duration: 200, scale: 1, translateY: 0 });
  });

  it("while Reduce Motion is still unknown, plays the reduced version", () => {
    expect(sendExit(null)).toEqual(sendExit(true));
  });
});

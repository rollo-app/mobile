import { nextFlash } from "../flash";

describe("nextFlash", () => {
  it("rotates auto, on, off", () => {
    expect(nextFlash("auto")).toBe("on");
    expect(nextFlash("on")).toBe("off");
    expect(nextFlash("off")).toBe("auto");
  });
});

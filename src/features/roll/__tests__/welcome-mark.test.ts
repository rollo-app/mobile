import { welcomeMark } from "../welcome-mark";

describe("welcomeMark", () => {
  it("waits while the seen flag is unknown", () => {
    expect(welcomeMark(null, false)).toBe("wait");
    expect(welcomeMark(null, null)).toBe("wait");
  });

  it("plays the first time when motion is allowed", () => {
    expect(welcomeMark(false, false)).toBe("play");
  });

  it("waits for Reduce Motion to be known before playing the first time", () => {
    expect(welcomeMark(false, null)).toBe("wait");
  });

  it("is still with Reduce Motion on", () => {
    expect(welcomeMark(false, true)).toBe("still");
  });

  it("is still once seen, whatever Reduce Motion says", () => {
    expect(welcomeMark(true, false)).toBe("still");
    expect(welcomeMark(true, true)).toBe("still");
    expect(welcomeMark(true, null)).toBe("still");
  });
});

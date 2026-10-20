import { canCreate, defaultStart } from "../create-form";

const HOUR = 60 * 60 * 1000;
const T = Date.UTC(2027, 0, 5, 12, 0);

describe("defaultStart", () => {
  it("rounds up to the next full hour", () => {
    expect(defaultStart(T + 20 * 60 * 1000)).toBe(T + HOUR);
  });

  it("moves to the next hour even on the exact hour", () => {
    expect(defaultStart(T)).toBe(T + HOUR);
  });
});

describe("canCreate", () => {
  it("accepts a name", () => {
    expect(canCreate("Sur 2027")).toBe(true);
  });

  it("requires a name, ignoring blanks", () => {
    expect(canCreate("  ")).toBe(false);
    expect(canCreate("")).toBe(false);
  });
});
